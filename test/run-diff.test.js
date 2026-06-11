const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");

function runDiff(extraEnv = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bomly-action-test-"));
  const binDir = path.join(dir, "bin");
  fs.mkdirSync(binDir);
  const argsFile = path.join(dir, "args.json");
  const outputFile = path.join(dir, "github-output");
  const stub = path.join(binDir, "bomly");
  fs.writeFileSync(
    stub,
    `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
fs.writeFileSync(process.env.BOMLY_ARGS_FILE, JSON.stringify(args));
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-o" && args[i + 1]?.startsWith("markdown=")) {
    fs.writeFileSync(args[i + 1].slice("markdown=".length), "# Summary\\n");
  }
  if (args[i] === "-o" && args[i + 1]?.startsWith("sarif=")) {
    fs.writeFileSync(args[i + 1].slice("sarif=".length), "{}\\n");
  }
}
process.stdout.write(JSON.stringify({ results: { dependencies: {} }, audit: { introduced: [] } }));
`,
  );
  fs.chmodSync(stub, 0o755);

  const result = spawnSync("bash", [path.join(repoRoot, "scripts/run-diff.sh")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      BOMLY_ARGS_FILE: argsFile,
      GITHUB_OUTPUT: outputFile,
      RUNNER_TEMP: dir,
      BASE_REF: "base",
      HEAD_REF: "head",
      INPUT_LOG_LEVEL: "quiet",
      INPUT_COMMENT_SUMMARY_IN_PR: "never",
      ...extraEnv,
    },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `run-diff.sh failed with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  return JSON.parse(fs.readFileSync(argsFile, "utf8"));
}

test("maps safe diff inputs to bomly diff flags", () => {
  const args = runDiff({
    INPUT_ENRICH: "true",
    INPUT_AUDIT: "true",
    INPUT_ANALYZE: "true",
    INPUT_FAIL_ON: "high, reachable",
    INPUT_ALLOW_LICENSES: "MIT,Apache-2.0",
    INPUT_DENY_LICENSES: "GPL-3.0-only",
    INPUT_LICENSE_EXEMPT_PACKAGES: "pkg:npm/example@1.0.0",
    INPUT_ALLOW_VULNERABILITY_IDS: "GHSA-xxxx-yyyy-zzzz",
    INPUT_DENY_PACKAGES: "pkg:npm/bad@1.0.0",
    INPUT_DENY_GROUPS: "pkg:npm/@bad",
    INPUT_PROTECTED_PACKAGES: "react",
    INPUT_TYPOSQUAT_THRESHOLD: "0.85",
    INPUT_TYPOSQUAT_MODE: "fail",
    INPUT_WARN_ONLY: "true",
    INPUT_ECOSYSTEMS: "+npm",
    INPUT_DETECTORS: "npm-lock",
    INPUT_MATCHERS: "+osv",
    INPUT_AUDITORS: "vulnerability",
    INPUT_ANALYZERS: "+jsreach",
    INPUT_INSTALL_FIRST: "true",
    INPUT_INSTALL_ARGS: "--frozen-lockfile,--offline",
  });

  assert.deepEqual(args.slice(0, 5), ["diff", "--base", "base", "--head", "head"]);
  for (const expected of [
    "--format",
    "json",
    "--audit",
    "--enrich",
    "--analyze",
    "--fail-on",
    "high",
    "--fail-on",
    "reachable",
    "--allow-license",
    "MIT",
    "--deny-license",
    "GPL-3.0-only",
    "--license-exempt-package",
    "pkg:npm/example@1.0.0",
    "--allow-vulnerability-id",
    "GHSA-xxxx-yyyy-zzzz",
    "--deny-package",
    "pkg:npm/bad@1.0.0",
    "--deny-group",
    "pkg:npm/@bad",
    "--protected-package",
    "react",
    "--typosquat-threshold",
    "0.85",
    "--typosquat-mode",
    "fail",
    "--warn-only",
    "--ecosystems",
    "+npm",
    "--detectors",
    "npm-lock",
    "--matchers",
    "+osv",
    "--auditors",
    "vulnerability",
    "--analyzers",
    "+jsreach",
    "--install-first",
    "--install-arg",
    "--frozen-lockfile",
    "--install-arg",
    "--offline",
  ]) {
    assert.ok(args.includes(expected), `expected ${expected} in ${args.join(" ")}`);
  }
});

test("audit false skips audit flag and sarif output", () => {
  const args = runDiff({
    INPUT_ENRICH: "false",
    INPUT_AUDIT: "false",
  });

  assert.equal(args.includes("--audit"), false);
  assert.equal(args.some((arg) => arg.startsWith("sarif=")), false);
  assert.equal(args.includes("--enrich"), false);
});
