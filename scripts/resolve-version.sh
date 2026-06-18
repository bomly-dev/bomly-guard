#!/usr/bin/env bash
set -euo pipefail

curl_args=(-fsSL)
if [ -n "${INPUT_CLI_TOKEN:-}" ]; then
  curl_args+=(-H "Authorization: Bearer ${INPUT_CLI_TOKEN}")
fi

version="$INPUT_VERSION"
if [ "$version" = "latest" ]; then
  echo "Resolving latest Bomly CLI release"
  release_json="$(curl "${curl_args[@]}" https://api.github.com/repos/bomly-dev/bomly-cli/releases/latest)"
  version="$(printf '%s\n' "$release_json" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  if [ -z "$version" ]; then
    echo "::error::Unable to resolve latest Bomly CLI release"
    exit 1
  fi
fi
if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.]+)?$ ]]; then
  version="v${version}"
fi
if [[ ! "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.]+)?$ ]]; then
  echo "::error::Invalid Bomly version '$version'. Use latest, vX.Y.Z, or X.Y.Z."
  exit 1
fi
echo "Using Bomly CLI ${version}"
echo "version=$version" >> "$GITHUB_OUTPUT"
