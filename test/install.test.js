const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");

function makeArchive(dir, name) {
  const payloadDir = path.join(dir, `${name}-payload`);
  fs.mkdirSync(payloadDir);
  fs.writeFileSync(path.join(payloadDir, "bomly"), "#!/usr/bin/env sh\necho bomly\n");
  fs.chmodSync(path.join(payloadDir, "bomly"), 0o755);

  const archive = path.join(dir, name);
  const tar = spawnSync("tar", ["-czf", archive, "-C", payloadDir, "bomly"], { encoding: "utf8" });
  if (tar.status !== 0) {
    throw new Error(`tar failed\nstdout:\n${tar.stdout}\nstderr:\n${tar.stderr}`);
  }
  return archive;
}

function runInstall({ version, assets, checksumName }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bomly-install-test-"));
  const releaseDir = path.join(dir, "release");
  const binDir = path.join(dir, "bin");
  fs.mkdirSync(releaseDir);
  fs.mkdirSync(binDir);

  for (const asset of assets) {
    makeArchive(releaseDir, asset);
  }
  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(releaseDir, checksumName)))
    .digest("hex");
  fs.writeFileSync(path.join(releaseDir, "SHA256SUMS"), `${hash}  dist/${checksumName}\n`);

  fs.writeFileSync(
    path.join(binDir, "gh"),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "release" ] && [ "$2" = "view" ]; then
  printf '%s\\n' "$BOMLY_TEST_ASSETS"
  exit 0
fi
if [ "$1" = "release" ] && [ "$2" = "download" ]; then
  dir=""
  patterns=()
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --dir)
        dir="$2"
        shift 2
        ;;
      --pattern)
        patterns+=("$2")
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done
  for pattern in "$\{patterns[@]}"; do
    cp "$BOMLY_TEST_RELEASE_DIR/$pattern" "$dir/"
  done
  exit 0
fi
exit 1
`,
  );
  fs.chmodSync(path.join(binDir, "gh"), 0o755);

  const result = spawnSync("bash", [path.join(repoRoot, "scripts/install.sh")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      VERSION: version,
      TARGET_OS: "linux",
      TARGET_ARCH: "amd64",
      ARCHIVE_EXT: "tar.gz",
      BINARY_NAME: "bomly",
      GITHUB_OUTPUT: path.join(dir, "github-output"),
      GITHUB_PATH: path.join(dir, "github-path"),
      RUNNER_TOOL_CACHE: path.join(dir, "tool-cache"),
      BOMLY_TEST_ASSETS: assets.join("\n"),
      BOMLY_TEST_RELEASE_DIR: releaseDir,
    },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `install.sh failed with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  return {
    output: result.stdout,
    installDir: fs.readFileSync(path.join(dir, "github-path"), "utf8").trim(),
  };
}

test("installs current releases whose archive names omit the tag prefix", () => {
  const archive = "bomly_0.14.6_linux_amd64.tar.gz";
  const result = runInstall({
    version: "v0.14.6",
    assets: [archive, "bomly_v0.14.6_linux_amd64.tar.gz", "SHA256SUMS"],
    checksumName: archive,
  });

  assert.match(result.output, new RegExp(`Downloading ${archive}`));
  assert.equal(fs.existsSync(path.join(result.installDir, "bomly")), true);
});

test("still installs older releases whose archive names include the tag prefix", () => {
  const archive = "bomly_v0.14.2_linux_amd64.tar.gz";
  const result = runInstall({
    version: "v0.14.2",
    assets: [archive, "SHA256SUMS"],
    checksumName: archive,
  });

  assert.match(result.output, new RegExp(`Downloading ${archive}`));
  assert.equal(fs.existsSync(path.join(result.installDir, "bomly")), true);
});
