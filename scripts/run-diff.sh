#!/usr/bin/env bash
set -euo pipefail

diff_json="${RUNNER_TEMP:-.}/bomly-diff.json"
summary_md="${RUNNER_TEMP:-.}/bomly-summary.md"
sarif_file="${RUNNER_TEMP:-.}/bomly.sarif"
args=(diff --base "$BASE_REF" --head "$HEAD_REF" --enrich --audit --format json -o "markdown=$summary_md" -o "sarif=$sarif_file")

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}
add_csv_flags() {
  local flag="$1"
  local raw="$2"
  local item
  [ -z "$raw" ] && return 0
  IFS=',' read -ra values <<< "$raw"
  for item in "${values[@]}"; do
    item="$(trim "$item")"
    [ -n "$item" ] && args+=("$flag" "$item")
  done
}
add_bool_flag() {
  local flag="$1"
  local raw="$2"
  case "$raw" in
    true) args+=("$flag") ;;
    false|"") ;;
    *) echo "::error::Invalid boolean value '$raw' for $flag"; exit 1 ;;
  esac
}

case "$INPUT_COMMENT_SUMMARY_IN_PR" in
  ""|never|always|on-failure) ;;
  *) echo "::error::comment-summary-in-pr must be one of never, always, or on-failure"; exit 1 ;;
esac
case "$INPUT_LOG_LEVEL" in
  quiet|"") ;;
  verbose) args=(-v "${args[@]}") ;;
  debug) args=(-vv "${args[@]}") ;;
  *) echo "::error::log-level must be one of quiet, verbose, or debug"; exit 1 ;;
esac

[ -n "$CONFIG_FILE" ] && args+=(--config "$CONFIG_FILE")
[ -n "$INPUT_FAIL_ON_SEVERITY" ] && args+=(--fail-on "$INPUT_FAIL_ON_SEVERITY")
add_csv_flags --fail-on-scope "$INPUT_FAIL_ON_SCOPES"
add_csv_flags --allow-license "$INPUT_ALLOW_LICENSES"
add_csv_flags --deny-license "$INPUT_DENY_LICENSES"
add_csv_flags --license-exempt-package "$INPUT_ALLOW_DEPENDENCIES_LICENSES"
add_csv_flags --allow-vulnerability-id "$INPUT_ALLOW_GHSAS"
add_csv_flags --deny-package "$INPUT_DENY_PACKAGES"
add_csv_flags --deny-group "$INPUT_DENY_GROUPS"
add_csv_flags --protected-package "$INPUT_PROTECTED_PACKAGES"
[ -n "$INPUT_TYPOSQUAT_THRESHOLD" ] && args+=(--typosquat-threshold "$INPUT_TYPOSQUAT_THRESHOLD")
[ -n "$INPUT_TYPOSQUAT_MODE" ] && args+=(--typosquat-mode "$INPUT_TYPOSQUAT_MODE")
add_bool_flag --warn-only "$INPUT_WARN_ONLY"

echo "Running Bomly diff with log-level=${INPUT_LOG_LEVEL:-quiet}"
echo "JSON: ${diff_json}"
echo "Markdown summary: ${summary_md}"
echo "SARIF: ${sarif_file}"

set +e
bomly "${args[@]}" > "$diff_json"
exit_code=$?
set -e
if [ "$exit_code" -ne 0 ] && [ "$exit_code" -ne 2 ]; then
  exit "$exit_code"
fi
echo "Bomly diff completed with exit code ${exit_code}"
{
  echo "diff-json=$diff_json"
  echo "summary-md=$summary_md"
  echo "sarif-file=$sarif_file"
  echo "exit-code=$exit_code"
} >> "$GITHUB_OUTPUT"
