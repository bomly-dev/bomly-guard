const fs = require("fs");

function loadPayload(payloadPath) {
  if (!payloadPath || !fs.existsSync(payloadPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(payloadPath, "utf8"));
}

function resolveRefs(env = process.env, payload = loadPayload(env.GITHUB_EVENT_PATH)) {
  const event = env.GITHUB_EVENT_NAME || "";
  const explicitBase = env.INPUT_BASE_REF || "";
  const explicitHead = env.INPUT_HEAD_REF || "";

  let base = explicitBase;
  let head = explicitHead;
  let baseFetchRef = explicitBase;
  let headFetchRef = explicitHead;
  let pr = "";
  let useMergeBase = "false";

  if (event === "pull_request" || event === "pull_request_target") {
    const pull = payload.pull_request || {};
    pr = String(pull.number || "");
    head = head || pull.head?.sha || "";

    if (!explicitBase) {
      base = pull.base?.sha || "";
      baseFetchRef = pull.base?.ref ? `refs/heads/${pull.base.ref}` : base;
      useMergeBase = "true";
    }
    if (!explicitHead) {
      headFetchRef = pr ? `refs/pull/${pr}/head` : head;
    }
  }

  if ((!base || !head) && event === "merge_group") {
    base = base || payload.merge_group?.base_sha || "";
    head = head || payload.merge_group?.head_sha || "";
    baseFetchRef = baseFetchRef || base;
    headFetchRef = headFetchRef || head;
  }

  if (!pr && payload.pull_request?.number) {
    pr = String(payload.pull_request.number);
  }

  baseFetchRef = baseFetchRef || base;
  headFetchRef = headFetchRef || head;

  if (!base || !head) {
    throw new Error(
      "Both base-ref and head-ref are required outside pull_request, pull_request_target, or merge_group events",
    );
  }

  return { base, head, pr, baseFetchRef, headFetchRef, useMergeBase };
}

function writeOutputs(outputs, outputPath = process.env.GITHUB_OUTPUT) {
  const lines = [
    `base=${outputs.base}`,
    `head=${outputs.head}`,
    `pr=${outputs.pr}`,
    `base-fetch-ref=${outputs.baseFetchRef}`,
    `head-fetch-ref=${outputs.headFetchRef}`,
    `use-merge-base=${outputs.useMergeBase}`,
  ];
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
}

if (require.main === module) {
  const outputs = resolveRefs();
  console.log(
    `Comparing ${outputs.base} -> ${outputs.head}${outputs.pr ? ` for PR #${outputs.pr}` : ""}`,
  );
  if (outputs.useMergeBase === "true") {
    console.log(
      `Pull request comparison will use merge base of ${outputs.baseFetchRef} and ${outputs.head}`,
    );
  }
  writeOutputs(outputs);
}

module.exports = { resolveRefs };
