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

function runInstall({ version, assets, checksumName, token = "" }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bomly-install-test-"));
  const releaseDir = path.join(dir, "release");
  const binDir = path.join(dir, "bin");
  const authFile = path.join(dir, "auth-headers");
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
    path.join(binDir, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
out=""
url=""
auth=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      out="$2"
      shift 2
      ;;
    -H)
      auth="$2"
      shift 2
      ;;
    -*)
      shift
      ;;
    *)
      url="$1"
      shift
      ;;
  esac
done
if [ -n "$auth" ]; then
  printf '%s\\n' "$auth" >> "$BOMLY_TEST_AUTH_FILE"
fi
asset="$\{url##*/}"
if [ -n "$out" ]; then
  if [ ! -f "$BOMLY_TEST_RELEASE_DIR/$asset" ]; then
    exit 22
  fi
  cp "$BOMLY_TEST_RELEASE_DIR/$asset" "$out"
  exit 0
fi
if [ "$url" = "https://api.github.com/repos/bomly-dev/bomly-cli/releases/latest" ]; then
  printf '{"tag_name":"%s"}\\n' "$BOMLY_TEST_LATEST_VERSION"
  exit 0
fi
exit 22
`,
  );
  fs.chmodSync(path.join(binDir, "curl"), 0o755);

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
      INPUT_CLI_TOKEN: token,
      GITHUB_OUTPUT: path.join(dir, "github-output"),
      GITHUB_PATH: path.join(dir, "github-path"),
      RUNNER_TOOL_CACHE: path.join(dir, "tool-cache"),
      BOMLY_TEST_RELEASE_DIR: releaseDir,
      BOMLY_TEST_LATEST_VERSION: "v0.14.6",
      BOMLY_TEST_AUTH_FILE: authFile,
    },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `install.sh failed with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  return {
    authHeaders: fs.existsSync(authFile) ? fs.readFileSync(authFile, "utf8") : "",
    output: result.stdout,
    installDir: fs.readFileSync(path.join(dir, "github-path"), "utf8").trim(),
  };
}

function runResolveVersion(version, token = "") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bomly-resolve-test-"));
  const binDir = path.join(dir, "bin");
  const authFile = path.join(dir, "auth-headers");
  fs.mkdirSync(binDir);

  fs.writeFileSync(
    path.join(binDir, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
url=""
auth=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -H)
      auth="$2"
      shift 2
      ;;
    -*)
      shift
      ;;
    *)
      url="$1"
      shift
      ;;
  esac
done
if [ -n "$auth" ]; then
  printf '%s\\n' "$auth" >> "$BOMLY_TEST_AUTH_FILE"
fi
if [ "$url" = "https://api.github.com/repos/bomly-dev/bomly-cli/releases/latest" ]; then
  printf '{"tag_name":"v0.14.6"}\\n'
  exit 0
fi
exit 22
`,
  );
  fs.chmodSync(path.join(binDir, "curl"), 0o755);

  const result = spawnSync("bash", [path.join(repoRoot, "scripts/resolve-version.sh")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
      INPUT_VERSION: version,
      INPUT_CLI_TOKEN: token,
      GITHUB_OUTPUT: path.join(dir, "github-output"),
      BOMLY_TEST_AUTH_FILE: authFile,
    },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `resolve-version.sh failed with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  return {
    authHeaders: fs.existsSync(authFile) ? fs.readFileSync(authFile, "utf8") : "",
    output: result.stdout,
    githubOutput: fs.readFileSync(path.join(dir, "github-output"), "utf8"),
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

test("resolves latest release without requiring GitHub CLI auth", () => {
  const result = runResolveVersion("latest");

  assert.match(result.output, /Resolving latest Bomly CLI release/);
  assert.match(result.output, /Using Bomly CLI v0.14.6/);
  assert.equal(result.githubOutput, "version=v0.14.6\n");
  assert.equal(result.authHeaders, "");
});

test("uses optional CLI token for release API and download requests", () => {
  const resolved = runResolveVersion("latest", "ghs_example");
  assert.equal(resolved.authHeaders, "Authorization: Bearer ghs_example\n");

  const archive = "bomly_0.14.6_linux_amd64.tar.gz";
  const installed = runInstall({
    version: "v0.14.6",
    assets: [archive, "SHA256SUMS"],
    checksumName: archive,
    token: "ghs_example",
  });

  assert.match(installed.authHeaders, /Authorization: Bearer ghs_example/);
});
