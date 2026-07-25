const fs = require("fs");

const payload = JSON.parse(fs.readFileSync(process.env.DIFF_JSON, "utf8"));
const summary = fs.readFileSync(process.env.SUMMARY_MD, "utf8");
const introduced = payload.audit?.introduced || [];
const persisted = payload.audit?.persisted || [];
// The CLI gates on introduced + persisted (auditBlockingFindings in
// internal/cli/diff_cmd.go). The diff's focused audit graph only covers added,
// removed, and version-changed packages, so a persisted finding still means
// "this package change ships a known issue" — not pre-existing debt.
// status always reflects which list the finding came from, so consumers can
// rely on it being exactly "introduced" or "persisted".
const blocking = [
  ...introduced.map((f) => ({ ...f, status: "introduced" })),
  ...persisted.map((f) => ({ ...f, status: "persisted" })),
];
const vulnerable = blocking.filter((f) => f.auditor === "vulnerability");
const invalidLicenses = blocking.filter((f) => f.auditor === "license");
const denied = blocking.filter(
  (f) => f.auditor === "package" && String(f.id || "").includes("denied-"),
);
const suspicious = blocking.filter(
  (f) =>
    f.auditor === "package" &&
    String(f.id || "").includes("suspicious-package"),
);
const failing = blocking.filter(
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

console.log(
  `Extracted ${introduced.length} introduced + ${persisted.length} persisted findings (${failing.length} failing)`,
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
