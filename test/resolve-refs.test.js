const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveRefs } = require("../scripts/resolve-refs");

test("pull request defaults to merge-base comparison inputs", () => {
  const payload = {
    pull_request: {
      number: 42,
      base: { ref: "main", sha: "base-sha" },
      head: { sha: "head-sha" },
    },
  };

  const got = resolveRefs({ GITHUB_EVENT_NAME: "pull_request" }, payload);

  assert.deepEqual(got, {
    base: "base-sha",
    head: "head-sha",
    pr: "42",
    baseFetchRef: "refs/heads/main",
    headFetchRef: "refs/pull/42/head",
    useMergeBase: "true",
  });
});

test("explicit base-ref bypasses merge-base computation", () => {
  const payload = {
    pull_request: {
      number: 7,
      base: { ref: "main", sha: "base-sha" },
      head: { sha: "head-sha" },
    },
  };

  const got = resolveRefs(
    {
      GITHUB_EVENT_NAME: "pull_request",
      INPUT_BASE_REF: "origin/release",
      INPUT_HEAD_REF: "custom-head",
    },
    payload,
  );

  assert.deepEqual(got, {
    base: "origin/release",
    head: "custom-head",
    pr: "7",
    baseFetchRef: "origin/release",
    headFetchRef: "custom-head",
    useMergeBase: "false",
  });
});

test("merge group uses event base and head shas", () => {
  const payload = {
    merge_group: {
      base_sha: "merge-base-sha",
      head_sha: "merge-head-sha",
    },
  };

  const got = resolveRefs({ GITHUB_EVENT_NAME: "merge_group" }, payload);

  assert.equal(got.base, "merge-base-sha");
  assert.equal(got.head, "merge-head-sha");
  assert.equal(got.useMergeBase, "false");
});
