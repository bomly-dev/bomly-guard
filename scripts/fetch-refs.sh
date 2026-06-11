#!/usr/bin/env bash
set -euo pipefail

base_ref="${BASE_REF}"
head_ref="${HEAD_REF}"
base_fetch_ref="${BASE_FETCH_REF:-$base_ref}"
head_fetch_ref="${HEAD_FETCH_REF:-$head_ref}"
use_merge_base="${USE_MERGE_BASE:-false}"

fetch_ref() {
  local ref="$1"
  local label="$2"
  local target_ref="refs/bomly-action/${label}"
  [ -z "$ref" ] && return 0
  if git cat-file -e "${ref}^{commit}" 2>/dev/null; then
    echo "${label} commit ${ref} is already available locally"
    return 0
  fi
  echo "Fetching ${label} ref ${ref} from origin"
  git fetch --no-tags --prune --depth=64 origin "+${ref}:${target_ref}"
  if [ "$label" = "base" ] || [ "$label" = "base-commit" ]; then
    base_ref="$(git rev-parse "${target_ref}^{commit}")"
  else
    head_ref="$(git rev-parse "${target_ref}^{commit}")"
  fi
}

ensure_commit() {
  local ref="$1"
  local label="$2"
  if ! git cat-file -e "${ref}^{commit}" 2>/dev/null; then
    echo "::error::Unable to resolve ${label} commit ${ref}"
    exit 1
  fi
}

fetch_ref "$base_fetch_ref" "base"
fetch_ref "$head_fetch_ref" "head"

if ! git cat-file -e "${base_ref}^{commit}" 2>/dev/null && [ "$base_fetch_ref" != "$base_ref" ]; then
  fetch_ref "$base_ref" "base-commit"
fi
if ! git cat-file -e "${head_ref}^{commit}" 2>/dev/null && [ "$head_fetch_ref" != "$head_ref" ]; then
  fetch_ref "$head_ref" "head-commit"
fi

ensure_commit "$base_ref" "base"
ensure_commit "$head_ref" "head"

if [ "$use_merge_base" = "true" ]; then
  echo "Computing pull request merge base"
  deepen=64
  merge_base=""
  for _ in 1 2 3 4 5; do
    merge_base="$(git merge-base "$base_ref" "$head_ref" 2>/dev/null || true)"
    [ -n "$merge_base" ] && break
    echo "Deepening fetched refs by ${deepen} commits to find merge base"
    git fetch --no-tags --prune --deepen="$deepen" origin "$base_fetch_ref" "$head_fetch_ref"
    deepen=$((deepen * 2))
  done
  if [ -z "$merge_base" ]; then
    echo "::error::Unable to compute merge base for ${base_ref} and ${head_ref}"
    exit 1
  fi
  base_ref="$merge_base"
  echo "Using PR merge base ${base_ref}"
else
  echo "Using explicit base ${base_ref}"
fi

{
  echo "base=$base_ref"
  echo "head=$head_ref"
} >> "$GITHUB_OUTPUT"
