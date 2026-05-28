const conventionalCommitRegex =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([A-Za-z0-9_ -]+\))?!?: .+$/;

async function extractGithubIssueReferences(
  body,
  keywords,
  github,
  context
) {
  const matches = [];
  const seen = new Set();

  //
  // Supports:
  //
  // Keyword references:
  //   fixes #123
  //   fixes repo#123
  //   fixes org/repo#123
  //
  // Direct GitHub issue URLs:
  //   https://github.com/org/repo/issues/123
  //

  const keywordsPattern = keywords.join("|");

  const keywordRegex = new RegExp(
    `\\b(${keywordsPattern})\\s+((?:[A-Za-z0-9_.-]+\\/)?[A-Za-z0-9_.-]+)?#(\\d+)`,
    "gi"
  );

  const urlRegex =
    /https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/(\d+)/gi;

  async function validateAndStore({
    keyword = "link",
    owner,
    repo,
    issueNumber,
  }) {
    // Enforce same organization only
    if (owner !== context.repo.owner) {
      throw new Error(
        `❌ Cross-organization issue reference is not allowed: ${owner}/${repo}#${issueNumber}`
      );
    }

    const dedupeKey = `${owner}/${repo}#${issueNumber}`;

    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);

    try {
      const { data: issue } = await github.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      // Ignore pull requests
      if (!("pull_request" in issue)) {
        matches.push({
          keyword,
          issue: issueNumber,
          owner,
          repo,
          url: issue.html_url,
        });
      } else {
        console.warn(
          `${owner}/${repo}#${issueNumber} is a PR, not an issue`
        );
      }
    } catch (error) {
      console.warn(
        `Issue not found: ${owner}/${repo}#${issueNumber}`
      );
    }
  }

  //
  // Parse keyword references
  //
  let match;

  while ((match = keywordRegex.exec(body)) !== null) {
    const keyword = match[1].toLowerCase();
    const repoRef = match[2];
    const issueNumber = Number(match[3]);

    let owner = context.repo.owner;
    let repo = context.repo.repo;

    if (repoRef) {
      if (repoRef.includes("/")) {
        [owner, repo] = repoRef.split("/");
      } else {
        repo = repoRef;
      }
    }

    await validateAndStore({
      keyword,
      owner,
      repo,
      issueNumber,
    });
  }

  //
  // Parse direct GitHub issue URLs
  //
  while ((match = urlRegex.exec(body)) !== null) {
    const owner = match[1];
    const repo = match[2];
    const issueNumber = Number(match[3]);

    await validateAndStore({
      keyword: "link",
      owner,
      repo,
      issueNumber,
    });
  }

  return matches;
}

async function getClosingIssueReferences(github, context) {
  const query = `
    query($owner: String!, $repo: String!, $pr: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          closingIssuesReferences(first: 20) {
            nodes {
              number
              url
              repository {
                name
                owner {
                  login
                }
              }
              labels(first: 10) {
                nodes {
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await github.graphql(query, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    pr: context.issue.number,
  });

  const issues =
    result.repository.pullRequest.closingIssuesReferences.nodes;

  // Enforce same-organization closing references
  for (const issue of issues) {
    const owner = issue.repository.owner.login;

    if (owner !== context.repo.owner) {
      throw new Error(
        `❌ Cross-organization closing reference is not allowed: ${owner}/${issue.repository.name}#${issue.number}`
      );
    }
  }

  return issues;
}

async function validatePr({ github, context, core }) {
  try {
    const pr = context.payload.pull_request;
    const body = (pr.body || "").trim();
    const title = pr.title;
    const labels = pr.labels.map((label) => label.name);

    const githubKeywords = [
      "close",
      "closes",
      "closed",
      "fix",
      "fixes",
      "fixed",
      "resolve",
      "resolves",
      "resolved",
    ];

    const referenceKeywords = [
      "ref",
      "refs",
      "reference",
      "references",
      "follow-up",
    ];

    if (!body) {
      core.setFailed("❌ PR description must not be empty.");
      return;
    }

    if (!conventionalCommitRegex.test(title)) {
      core.setFailed(`
❌ Invalid PR title.

Expected format:
type(scope[optional]): description

Examples:
feat(model split): added Qwen split
fix(data parallel): prevents serving from crashing when dp > 4
      `);
      return;
    }

    if (labels.includes("Cleanup")) {
      console.log(
        "⚠️ PR is marked as 'Cleanup', skipping further checks."
      );
      return;
    }

    if (labels.includes("Cross-repository")) {
      console.log(
        "⚠️ PR is marked as 'Cross-repository', skipping further checks."
      );
      return;
    }

    if (labels.includes("github_actions")) {
      console.log(
        "⚠️ PR updates GitHub Actions code, probably by bot. Skipping further checks."
      );
      return;
    }

    const githubIssueRefs =
      await extractGithubIssueReferences(
        body,
        githubKeywords,
        github,
        context
      );

    const referenceIssueRefs =
      await extractGithubIssueReferences(
        body,
        referenceKeywords,
        github,
        context
      );

    const allIssueRefs = [
      ...githubIssueRefs,
      ...referenceIssueRefs,
    ];

    const linkedIssues =
      await getClosingIssueReferences(github, context);

    if (linkedIssues.length + allIssueRefs.length === 0) {
      core.setFailed(`
❌ PR must reference an issue or be marked as Cleanup.

Use GitHub keywords to close issues:
  close, closes, fix, fixes, resolve, resolves

Use reference keywords for non-closing references:
  ref, refs, reference, references, follow-up

Examples:
  fixes #123
  fixes tllm-lugins#456
  fixes TurboNext/tllm-plugins#789

Non-closing references:
  refs #123
  follow-up backend#456

Direct links:
  https://github.com/TurboNext/tllm-plugins/issues/123
      `);

      return;
    }

    console.log(`
✅ PR will close ${linkedIssues.length} issue(s):
${linkedIssues.map((issue) => issue.url).join(", ")}
    `);

    console.log(`
✅ PR references ${allIssueRefs.length} issue(s):
${allIssueRefs.map((ref) => ref.url).join(", ")}
    `);
  } catch (error) {
    core.setFailed(error.message || String(error));
  }
}

module.exports = {
  validatePr,
  getClosingIssueReferences,
};
