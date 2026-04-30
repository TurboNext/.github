module.exports = async function ({ github, context, core }) {
    core.info("Beginning label check...");
    const pr = context.payload.pull_request;
    const labels = pr.labels.map(label => label.name);
    if (labels.length === 0) {
        core.setFailed("❌ No labels found on the PR. Please add at least one label. \n" +
        "Labels: Breaking change, Bug, Build, CI/CD, Cleanup, Cross-repository, Documentation, Enhancement, Test");
    }
    else{
        core.info(`✅ Labels found on the PR: ${labels.join(", ")}`);
    }
}
