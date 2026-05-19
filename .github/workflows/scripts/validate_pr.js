async function extractGithubIssueReferences(body, keywords, github, context, repo) {
// match keywords followed by #issue_number, case insensitive
  const keywordsPattern = keywords.join("|");
  const regex = new RegExp(`\\b(${keywordsPattern})\\s+#(\\d+)`, "gi");

  const matches = [];
  let match;
  if (repo == null){
      repo = context.repo.repo
  }

  while ((match = regex.exec(body)) !== null) {
    const issueNumber = Number(match[2]);
    console.log(issueNumber)

    try {
      // Check if the issue exists in the repository
      const { data: issue } = await github.rest.issues.get({
        owner: context.repo.owner,
        repo: repo,
        issue_number: issueNumber
      });
      console.log(issue)

      if (!('pull_request' in issue)) {
          matches.push({
            keyword: match[1].toLowerCase(),
            issue: issueNumber,
            url: issue.html_url
          });
      }
      else{
        console.warn(`Issue #${issueNumber} is a PR.`)
      }

    } catch (error) {
      console.warn(`Issue #${issueNumber} not found in ${context.repo.owner}/${context.repo.repo}`);
    }
  }

  return matches;
}

async function getClosingIssueReferences(github, context) {
    const query = `
            query($owner: String!, $repo: String!, $pr: Int!) {
            repository(owner: $owner, name: $repo) {
                pullRequest(number: $pr) {
                closingIssuesReferences(first: 10) {
                    nodes {
                        number
                        url
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

    return result.repository.pullRequest.closingIssuesReferences.nodes;
}

async function validatePr ({ github, context, core }) {
    const pr = context.payload.pull_request;
    const body = (pr.body || "").trim();
    const labels = pr.labels.map(label => label.name);
    const githubKeywords = ["close", "closes", "closed", "fix", "fixes", "fixed", "resolve", "resolves", "resolved"];
    const turbonextKeywords = ["ref", "refs", "reference", "references", "follow-up"];
    if (!body) {
        core.setFailed("❌ PR description must not be empty.");
    }

    if (labels.includes("Cleanup")) {
        console.log("⚠️ PR is marked as 'Cleanup', skipping further checks.");
        return;
    }

    if (labels.includes("Cross-repository")) {
        console.log("⚠️ PR is marked as 'Cross-repository', skipping further checks.");
        return;
    }

    if (labels.includes("github_actions")) {
        console.log("⚠️ PR updates GitHub Actions code, probably by bot. Skipping further checks.");
        return;
    }

    const githubIssueRefs = await extractGithubIssueReferences(body, githubKeywords, github, context, null);
    const turbonextIssueRefs = await extractGithubIssueReferences(body, turbonextKeywords, github, context, null);
    const oldRepoIssueRefs = await extractGithubIssueReferences(body, githubKeywords, github, context, "vllm-tn");
    const allIssueRefs = [...githubIssueRefs, ...turbonextIssueRefs, ...oldRepoIssueRefs];

    const linkedIssues = await getClosingIssueReferences(github, context);

    if (linkedIssues.length + allIssueRefs.length === 0) {
        core.setFailed("❌ PR must reference an issue or be marked up as Cleanup. Use github keywords to also close issue (close, fix, resolve). Use turbonext keywords to reference without closing (ref, reference, follow-up).");
    }
    else {
        console.log(`✅ PR will close ${linkedIssues.length} issue(s): 
            ${linkedIssues.map(issue => issue.url).join(", ")}`);
        console.log(`✅ PR references ${allIssueRefs.length} issue(s): 
            ${allIssueRefs.map(ref => ref.url).join(", ")}`);
    }
};

module.exports = {
  validatePr,
  getClosingIssueReferences,
};
