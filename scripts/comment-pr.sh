#!/usr/bin/env bash
set -euo pipefail

marker="<!-- bomly-review-action-comment -->"
body_file="${RUNNER_TEMP:-.}/bomly-comment.md"
payload_file="${RUNNER_TEMP:-.}/bomly-comment.json"
if [ "$(wc -c < "$COMMENT_MD")" -gt 65000 ]; then
  printf '# Bomly Diff Summary\n\nThe full summary is available in the workflow job summary.\n\n%s\n' "$marker" > "$body_file"
else
  cat "$COMMENT_MD" > "$body_file"
  printf '\n%s\n' "$marker" >> "$body_file"
fi
BODY_FILE="$body_file" PAYLOAD_FILE="$payload_file" node <<'NODE'
const fs = require('fs')
fs.writeFileSync(process.env.PAYLOAD_FILE, JSON.stringify({body: fs.readFileSync(process.env.BODY_FILE, 'utf8')}))
NODE
existing="$(
  gh api "repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments" --paginate \
    --jq ".[] | select(.body | contains(\"${marker}\")) | .id" | head -n 1
)"
if [ -n "$existing" ]; then
  gh api -X PATCH "repos/${GITHUB_REPOSITORY}/issues/comments/${existing}" --input "$payload_file" >/dev/null
  echo "Updated Bomly PR comment ${existing}"
else
  gh api -X POST "repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments" --input "$payload_file" >/dev/null
  echo "Created Bomly PR comment"
fi
