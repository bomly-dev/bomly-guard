const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function outputValue(file, name) {
  const line = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((item) => item.startsWith(`${name}=`));
  return line?.slice(name.length + 1) || "";
}

test("fetch-refs computes PR merge base", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bomly-fetch-test-"));
  const source = path.join(dir, "source");
  const work = path.join(dir, "work");
  fs.mkdirSync(source);

  git(source, ["init", "-b", "main"]);
  git(source, ["config", "user.name", "Test"]);
  git(source, ["config", "user.email", "test@example.com"]);
  fs.writeFileSync(path.join(source, "file.txt"), "base\n");
  git(source, ["add", "file.txt"]);
  git(source, ["commit", "-m", "base"]);
  const mergeBase = git(source, ["rev-parse", "HEAD"]);

  git(source, ["checkout", "-b", "feature"]);
  fs.writeFileSync(path.join(source, "feature.txt"), "feature\n");
  git(source, ["add", "feature.txt"]);
  git(source, ["commit", "-m", "feature"]);
  const head = git(source, ["rev-parse", "HEAD"]);

  git(source, ["checkout", "main"]);
  fs.writeFileSync(path.join(source, "main.txt"), "main\n");
  git(source, ["add", "main.txt"]);
  git(source, ["commit", "-m", "main"]);
  const base = git(source, ["rev-parse", "HEAD"]);

  execFileSync("git", ["clone", "--branch", "feature", `file://${source}`, work], {
    encoding: "utf8",
  });
  const output = path.join(dir, "github-output");

  execFileSync("bash", [path.join(repoRoot, "scripts/fetch-refs.sh")], {
    cwd: work,
    env: {
      ...process.env,
      GITHUB_OUTPUT: output,
      BASE_REF: base,
      HEAD_REF: head,
      BASE_FETCH_REF: "refs/heads/main",
      HEAD_FETCH_REF: "refs/heads/feature",
      USE_MERGE_BASE: "true",
    },
    encoding: "utf8",
  });

  assert.equal(outputValue(output, "base"), mergeBase);
  assert.equal(outputValue(output, "head"), head);
});
