#!/usr/bin/env bash
set -euo pipefail

mode="${INPUT_UPLOAD_SARIF:-auto}"
enabled=false
reason=""

case "$mode" in
  true|false|auto) ;;
  *) echo "::error::upload-sarif must be one of auto, true, or false"; exit 1 ;;
esac

if [ -z "${SARIF_FILE:-}" ] || [ ! -f "$SARIF_FILE" ]; then
  reason="SARIF file was not generated"
elif [ "$mode" = "false" ]; then
  reason="SARIF upload disabled by input"
elif [ "$mode" = "true" ]; then
  enabled=true
  reason="SARIF upload forced by input"
else
  repo_json="$(gh api "repos/${GITHUB_REPOSITORY}" 2>/dev/null || true)"
  if [ -z "$repo_json" ]; then
    reason="could not read repository security settings"
  else
    private="$(printf '%s' "$repo_json" | node -e 'const fs=require("fs"); const repo=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(String(repo.private === true));')"
    code_security="$(printf '%s' "$repo_json" | node -e 'const fs=require("fs"); const repo=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(repo.security_and_analysis?.code_security?.status || "unknown");')"
    if [ "$private" = "true" ] && [ "$code_security" != "enabled" ]; then
      reason="code scanning is unavailable because GitHub Code Security is ${code_security} for this private repository"
    elif ! gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}" --silent >/dev/null 2>&1; then
      reason="GITHUB_TOKEN is missing actions: read, which upload-sarif requires for private repositories"
    else
      enabled=true
      reason="repository supports SARIF upload"
    fi
  fi
fi

{
  echo "enabled=$enabled"
  echo "reason=$reason"
} >> "$GITHUB_OUTPUT"

if [ "$enabled" = "true" ]; then
  echo "SARIF upload enabled: $reason"
else
  echo "SARIF upload skipped: $reason"
fi
