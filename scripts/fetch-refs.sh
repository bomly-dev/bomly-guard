#!/usr/bin/env bash
set -euo pipefail

missing=0
git cat-file -e "${BASE_REF}^{commit}" 2>/dev/null || missing=1
git cat-file -e "${HEAD_REF}^{commit}" 2>/dev/null || missing=1
if [ "$missing" = "1" ]; then
  echo "Fetching comparison commits from origin"
  git fetch --no-tags --prune --depth=1 origin "$BASE_REF" "$HEAD_REF"
else
  echo "Comparison commits are already available locally"
fi
