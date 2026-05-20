#!/usr/bin/env bash
set -euo pipefail

config_file="$INPUT_CONFIG_FILE"
if [[ "$config_file" =~ ^([^/]+)/([^/]+)/(.+)@([^@]+)$ ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]}"
  path="${BASH_REMATCH[3]}"
  ref="${BASH_REMATCH[4]}"
  target="${RUNNER_TEMP:-.}/bomly-review-config.yaml"
  token="$INPUT_EXTERNAL_REPO_TOKEN"
  if [ -z "$token" ]; then
    token="$INPUT_REPO_TOKEN"
  fi
  echo "Reading external Bomly config ${owner}/${repo}/${path}@${ref}"
  GH_TOKEN="$token" gh api \
    -H "Accept: application/vnd.github.raw" \
    "repos/${owner}/${repo}/contents/${path}?ref=${ref}" > "$target"
  config_file="$target"
elif [ -n "$config_file" ]; then
  echo "Using Bomly config ${config_file}"
else
  echo "No Bomly config supplied"
fi
echo "path=$config_file" >> "$GITHUB_OUTPUT"
