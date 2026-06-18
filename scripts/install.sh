#!/usr/bin/env bash
set -euo pipefail

asset_version="${VERSION#v}"
archive_candidates=(
  "bomly_${asset_version}_${TARGET_OS}_${TARGET_ARCH}.${ARCHIVE_EXT}"
)
if [ "$asset_version" != "$VERSION" ]; then
  archive_candidates+=("bomly_${VERSION}_${TARGET_OS}_${TARGET_ARCH}.${ARCHIVE_EXT}")
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

release_assets="$(gh release view "$VERSION" --repo bomly-dev/bomly-cli --json assets -q '.assets[].name')"
archive=""
for candidate in "${archive_candidates[@]}"; do
  if grep -Fxq "$candidate" <<<"$release_assets"; then
    archive="$candidate"
    break
  fi
done
if [ -z "$archive" ]; then
  printf -v candidate_list "'%s', " "${archive_candidates[@]}"
  candidate_list="${candidate_list%, }"
  echo "::error::No Bomly CLI archive found for ${TARGET_OS}/${TARGET_ARCH}. Looked for ${candidate_list} in ${VERSION}."
  exit 1
fi

echo "Downloading ${archive} from bomly-dev/bomly-cli ${VERSION}"
gh release download "$VERSION" \
  --repo bomly-dev/bomly-cli \
  --pattern "$archive" \
  --pattern SHA256SUMS \
  --dir "$work_dir" \
  --clobber

expected_hash="$(awk -v archive="$archive" '{name=$NF; sub(/^dist\//, "", name); if (name == archive) {print $1; exit}}' "${work_dir}/SHA256SUMS")"
if [ -z "$expected_hash" ]; then
  echo "::error::Archive '${archive}' was not found in SHA256SUMS"
  exit 1
fi
if [[ ! "$expected_hash" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "::error::Malformed SHA256SUMS entry for '${archive}'"
  exit 1
fi
if command -v sha256sum >/dev/null 2>&1; then
  actual_hash="$(sha256sum "${work_dir}/${archive}" | awk '{print $1}')"
else
  actual_hash="$(shasum -a 256 "${work_dir}/${archive}" | awk '{print $1}')"
fi
expected_hash_lc="$(printf '%s' "$expected_hash" | tr '[:upper:]' '[:lower:]')"
actual_hash_lc="$(printf '%s' "$actual_hash" | tr '[:upper:]' '[:lower:]')"
if [ "$expected_hash_lc" != "$actual_hash_lc" ]; then
  echo "::error::Checksum mismatch for '${archive}'"
  exit 1
fi
echo "Checksum verified for ${archive}"

mkdir "${work_dir}/extract"
if [ "$ARCHIVE_EXT" = "zip" ]; then
  unzip -q "${work_dir}/${archive}" -d "${work_dir}/extract"
else
  tar xzf "${work_dir}/${archive}" -C "${work_dir}/extract"
fi
if [ -L "${work_dir}/extract/${BINARY_NAME}" ] || [ ! -f "${work_dir}/extract/${BINARY_NAME}" ]; then
  echo "::error::Expected Bomly binary '${BINARY_NAME}' was not found"
  exit 1
fi

install_dir="${RUNNER_TOOL_CACHE:-${RUNNER_TEMP:-/tmp}}/bomly/${VERSION}/${TARGET_OS}-${TARGET_ARCH}"
mkdir -p "$install_dir"
mv "${work_dir}/extract/${BINARY_NAME}" "$install_dir/"
chmod +x "$install_dir/${BINARY_NAME}" 2>/dev/null || true
echo "$install_dir" >> "$GITHUB_PATH"
echo "version=$VERSION" >> "$GITHUB_OUTPUT"
echo "Installed Bomly CLI to ${install_dir}"
