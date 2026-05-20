const fs = require("fs");

const payload = JSON.parse(fs.readFileSync(process.env.DIFF_JSON, "utf8"));
const summary = fs.readFileSync(process.env.SUMMARY_MD, "utf8");
const introduced = payload.audit?.introduced || [];
const vulnerable = introduced.filter((f) => f.auditor === "vulnerability");
const invalidLicenses = introduced.filter((f) => f.auditor === "license");
const denied = introduced.filter(
  (f) => f.auditor === "package" && String(f.id || "").includes("denied-"),
);
const suspicious = introduced.filter(
  (f) =>
    f.auditor === "package" &&
    String(f.id || "").includes("suspicious-package"),
);
const failing = introduced.filter(
  (f) => !f.disposition || f.disposition === "fail",
);
const comment = capMarkdownTables(summary, 25);
const commentPath = `${process.env.RUNNER_TEMP || "."}/bomly-comment-summary.md`;
fs.writeFileSync(commentPath, comment);

const values = {
  "dependency-changes": JSON.stringify(payload.results?.dependencies || {}),
  "vulnerable-changes": JSON.stringify(vulnerable),
  "invalid-license-changes": JSON.stringify(invalidLicenses),
  "denied-changes": JSON.stringify(denied),
  "suspicious-package-changes": JSON.stringify(suspicious),
  "comment-content": summary,
  "comment-md": commentPath,
  "issue-found": failing.length > 0 ? "true" : "false",
};
for (const [name, value] of Object.entries(values)) {
  writeOutput(name, value);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
console.log(
  `Extracted ${introduced.length} introduced findings (${failing.length} failing)`,
);
console.log(`Prepared PR comment summary at ${commentPath}`);

function writeOutput(name, value) {
  const delim = `bomly_${name}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `${name}<<${delim}\n${value}\n${delim}\n`,
  );
}

function capMarkdownTables(markdown, maxRows) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isTableHeader(lines, i)) {
      out.push(line);
      continue;
    }
    out.push(lines[i], lines[i + 1]);
    i += 2;
    let rowCount = 0;
    let hidden = 0;
    while (i < lines.length && isTableRow(lines[i])) {
      if (rowCount < maxRows) {
        out.push(lines[i]);
      } else {
        hidden++;
      }
      rowCount++;
      i++;
    }
    if (hidden > 0) {
      out.push(
        `_Showing ${maxRows} of ${rowCount} rows. See the workflow job summary for the full table._`,
      );
    }
    i--;
  }
  return out.join("\n");
}

function isTableHeader(lines, index) {
  return (
    isTableRow(lines[index]) &&
    index + 1 < lines.length &&
    /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1])
  );
}

function isTableRow(line) {
  return /^\|.*\|$/.test(line || "");
}
