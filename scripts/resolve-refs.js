const fs = require("fs");

const event = process.env.GITHUB_EVENT_NAME || "";
const payloadPath = process.env.GITHUB_EVENT_PATH || "";
const payload =
  payloadPath && fs.existsSync(payloadPath)
    ? JSON.parse(fs.readFileSync(payloadPath, "utf8"))
    : {};

let base = process.env.INPUT_BASE_REF || "";
let head = process.env.INPUT_HEAD_REF || "";
let pr = "";

if (
  (!base || !head) &&
  (event === "pull_request" || event === "pull_request_target")
) {
  base = base || payload.pull_request?.base?.sha || "";
  head = head || payload.pull_request?.head?.sha || "";
  pr = String(payload.pull_request?.number || "");
}
if ((!base || !head) && event === "merge_group") {
  base = base || payload.merge_group?.base_sha || "";
  head = head || payload.merge_group?.head_sha || "";
}
if (!pr && payload.pull_request?.number) {
  pr = String(payload.pull_request.number);
}
if (!base || !head) {
  throw new Error(
    "Both base-ref and head-ref are required outside pull_request, pull_request_target, or merge_group events",
  );
}

console.log(`Comparing ${base} -> ${head}${pr ? ` for PR #${pr}` : ""}`);
fs.appendFileSync(
  process.env.GITHUB_OUTPUT,
  `base=${base}\nhead=${head}\npr=${pr}\n`,
);
