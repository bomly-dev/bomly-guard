const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");

function extract(payload, summary = "# Summary\n") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bomly-extract-test-"));
  const diffJson = path.join(dir, "diff.json");
  const summaryMd = path.join(dir, "summary.md");
  const outputFile = path.join(dir, "github-output");
  fs.writeFileSync(diffJson, JSON.stringify(payload));
  fs.writeFileSync(summaryMd, summary);
  fs.writeFileSync(outputFile, "");

  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts/extract-outputs.js")],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        DIFF_JSON: diffJson,
        SUMMARY_MD: summaryMd,
        GITHUB_OUTPUT: outputFile,
        RUNNER_TEMP: dir,
      },
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `extract-outputs.js failed with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  return {
    outputs: parseOutputs(fs.readFileSync(outputFile, "utf8")),
    stdout: result.stdout,
  };
}

function parseOutputs(raw) {
  const outputs = {};
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = /^([^<]+)<<(.+)$/.exec(lines[i]);
    if (!match) continue;
    const [, name, delim] = match;
    const value = [];
    i++;
    while (i < lines.length && lines[i] !== delim) {
      value.push(lines[i]);
      i++;
    }
    outputs[name] = value.join("\n");
  }
  return outputs;
}

test("persisted failing findings mark the run as failing", () => {
  const { outputs, stdout } = extract({
    results: { dependencies: {} },
    audit: {
      introduced: [],
      persisted: [
        { id: "GHSA-aaaa", auditor: "vulnerability", disposition: "fail" },
        { id: "GHSA-bbbb", auditor: "vulnerability" },
      ],
    },
  });

  assert.equal(outputs["issue-found"], "true");
  const vulnerable = JSON.parse(outputs["vulnerable-changes"]);
  assert.equal(vulnerable.length, 2);
  assert.deepEqual(
    vulnerable.map((f) => f.status),
    ["persisted", "persisted"],
  );
  assert.match(
    stdout,
    /Extracted 0 introduced \+ 2 persisted findings \(2 failing\)/,
  );
});

test("introduced and persisted findings are combined per auditor", () => {
  const { outputs } = extract({
    results: { dependencies: {} },
    audit: {
      introduced: [
        { id: "GHSA-aaaa", auditor: "vulnerability" },
        { id: "license-invalid", auditor: "license" },
      ],
      persisted: [
        { id: "denied-pkg", auditor: "package" },
        { id: "suspicious-package-typosquat", auditor: "package" },
      ],
    },
  });

  assert.equal(outputs["issue-found"], "true");
  assert.deepEqual(
    JSON.parse(outputs["vulnerable-changes"]).map((f) => f.status),
    ["introduced"],
  );
  assert.deepEqual(
    JSON.parse(outputs["invalid-license-changes"]).map((f) => f.status),
    ["introduced"],
  );
  assert.deepEqual(
    JSON.parse(outputs["denied-changes"]).map((f) => f.id),
    ["denied-pkg"],
  );
  assert.deepEqual(
    JSON.parse(outputs["suspicious-package-changes"]).map((f) => f.id),
    ["suspicious-package-typosquat"],
  );
});

test("status always reflects the list a finding came from", () => {
  const { outputs } = extract({
    results: { dependencies: {} },
    audit: {
      introduced: [
        { id: "GHSA-aaaa", auditor: "vulnerability", status: "persisted" },
      ],
      persisted: [
        { id: "GHSA-bbbb", auditor: "vulnerability", status: "whatever" },
      ],
    },
  });

  assert.deepEqual(
    JSON.parse(outputs["vulnerable-changes"]).map((f) => [f.id, f.status]),
    [
      ["GHSA-aaaa", "introduced"],
      ["GHSA-bbbb", "persisted"],
    ],
  );
});

test("waived findings do not fail the run", () => {
  const { outputs, stdout } = extract({
    results: { dependencies: {} },
    audit: {
      introduced: [
        { id: "GHSA-aaaa", auditor: "vulnerability", disposition: "waived" },
      ],
      persisted: [
        { id: "GHSA-bbbb", auditor: "vulnerability", disposition: "waived" },
      ],
    },
  });

  assert.equal(outputs["issue-found"], "false");
  assert.equal(JSON.parse(outputs["vulnerable-changes"]).length, 2);
  assert.match(
    stdout,
    /Extracted 1 introduced \+ 1 persisted findings \(0 failing\)/,
  );
});

test("a clean diff reports no findings", () => {
  const { outputs, stdout } = extract({
    results: { dependencies: { added: [] } },
    audit: { introduced: [], persisted: [] },
  });

  assert.equal(outputs["issue-found"], "false");
  assert.equal(outputs["vulnerable-changes"], "[]");
  assert.equal(outputs["dependency-changes"], JSON.stringify({ added: [] }));
  assert.match(
    stdout,
    /Extracted 0 introduced \+ 0 persisted findings \(0 failing\)/,
  );
});

test("missing audit section is tolerated", () => {
  const { outputs } = extract({ results: {} });

  assert.equal(outputs["issue-found"], "false");
  assert.equal(outputs["vulnerable-changes"], "[]");
  assert.equal(outputs["dependency-changes"], "{}");
});
