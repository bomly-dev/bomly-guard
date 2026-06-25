#!/usr/bin/env bash
set -euo pipefail

diff_json="${RUNNER_TEMP:-.}/bomly-diff.json"
summary_md="${RUNNER_TEMP:-.}/bomly-summary.md"
sarif_file="${RUNNER_TEMP:-.}/bomly.sarif"
args=(diff --base "$BASE_REF" --head "$HEAD_REF" --format json -o "markdown=$summary_md")

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

add_value_flag() {
  local flag="$1"
  local raw="$2"
  [ -n "$raw" ] && args+=("$flag" "$raw")
  return 0
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

if [ "${INPUT_AUDIT:-true}" = "true" ]; then
  args+=(--audit -o "sarif=$sarif_file")
elif [ "${INPUT_AUDIT:-true}" != "false" ]; then
  echo "::error::Invalid boolean value '${INPUT_AUDIT}' for --audit"
  exit 1
fi

add_bool_flag --enrich "${INPUT_ENRICH:-true}"
add_bool_flag --analyze "${INPUT_ANALYZE:-false}"
add_bool_flag --warn-only "${INPUT_WARN_ONLY:-false}"
add_bool_flag --install-first "${INPUT_INSTALL_FIRST:-false}"

add_value_flag --config "${CONFIG_FILE:-}"
add_value_flag --ecosystems "${INPUT_ECOSYSTEMS:-}"
add_value_flag --detectors "${INPUT_DETECTORS:-}"
add_value_flag --matchers "${INPUT_MATCHERS:-}"
add_value_flag --auditors "${INPUT_AUDITORS:-}"
add_value_flag --analyzers "${INPUT_ANALYZERS:-}"
add_value_flag --typosquat-threshold "${INPUT_TYPOSQUAT_THRESHOLD:-}"
add_value_flag --typosquat-mode "${INPUT_TYPOSQUAT_MODE:-}"

add_csv_flags --fail-on "${INPUT_FAIL_ON:-}"
add_csv_flags --allow-license "${INPUT_ALLOW_LICENSES:-}"
add_csv_flags --deny-license "${INPUT_DENY_LICENSES:-}"
add_csv_flags --license-exempt-package "${INPUT_LICENSE_EXEMPT_PACKAGES:-}"
add_csv_flags --allow-vulnerability-id "${INPUT_ALLOW_VULNERABILITY_IDS:-}"
add_csv_flags --deny-package "${INPUT_DENY_PACKAGES:-}"
add_csv_flags --deny-group "${INPUT_DENY_GROUPS:-}"
add_csv_flags --protected-package "${INPUT_PROTECTED_PACKAGES:-}"
add_csv_flags --install-arg "${INPUT_INSTALL_ARGS:-}"

echo "Running Bomly diff with log-level=${INPUT_LOG_LEVEL:-quiet}"
echo "JSON: ${diff_json}"
echo "Markdown summary: ${summary_md}"
if [ "${INPUT_AUDIT:-true}" = "true" ]; then
  echo "SARIF: ${sarif_file}"
fi

set +e
bomly "${args[@]}" > "$diff_json"
exit_code=$?
set -e

# Exit 5 = "nothing to evaluate": the CLI found no subprojects/manifests to
# scan (commonly an ecosystems/detectors filter that doesn't apply to this
# repo). That's a benign no-op, not a failure, so Guard passes. The CLI errors
# before producing any output on this path, so synthesize an empty diff and a
# neutral summary that the downstream steps can consume unchanged (empty
# findings, no SARIF file -> upload auto-skips).
if [ "$exit_code" -eq 5 ]; then
  eco_note=""
  [ -n "${INPUT_ECOSYSTEMS:-}" ] && eco_note=" for ecosystem(s): ${INPUT_ECOSYSTEMS}"
  echo "::notice::Bomly found no applicable manifests to evaluate${eco_note}; nothing to scan."
  printf '{}' > "$diff_json"
  printf '# Bomly Diff Summary\n\nℹ️ No applicable manifests were found to evaluate%s. Nothing to scan — Bomly Guard passes.\n' "$eco_note" > "$summary_md"
  {
    echo "diff-json=$diff_json"
    echo "summary-md=$summary_md"
    echo "sarif-file=$sarif_file"
    echo "exit-code=0"
    echo "nothing-to-evaluate=true"
  } >> "$GITHUB_OUTPUT"
  exit 0
fi

if [ "$exit_code" -ne 0 ] && [ "$exit_code" -ne 2 ]; then
  exit "$exit_code"
fi
echo "Bomly diff completed with exit code ${exit_code}"
{
  echo "diff-json=$diff_json"
  echo "summary-md=$summary_md"
  echo "sarif-file=$sarif_file"
  echo "exit-code=$exit_code"
  echo "nothing-to-evaluate=false"
} >> "$GITHUB_OUTPUT"
