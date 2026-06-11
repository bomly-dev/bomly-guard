const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const action = fs.readFileSync("action.yml", "utf8");
const readme = fs.readFileSync("README.md", "utf8");

test("removed aliases are absent", () => {
  for (const alias of [
    "fail-on-severity",
    "fail-on-scopes",
    "allow-dependencies-licenses",
    "allow-ghsas",
    "INPUT_FAIL_ON_SCOPES",
    "--fail-on-scope",
    "INPUT_PATH",
    "INPUT_URL",
    "INPUT_CONTAINER",
    "INPUT_SBOM",
    "--path",
    "--url",
    "--container",
    "--sbom",
  ]) {
    assert.equal(action.includes(alias), false, `${alias} remains in action.yml`);
    assert.equal(readme.includes(alias), false, `${alias} remains in README.md`);
  }
});

test("marketplace metadata and renamed repo references are present", () => {
  assert.match(action, /^name: "Bomly Dependency Review"/m);
  assert.match(action, /^branding:/m);
  assert.match(readme, /bomly-dev\/bomly-dependency-review-action@v1/);
  assert.equal(readme.includes("bomly-dev/bomly-review-action@v1"), false);
});
