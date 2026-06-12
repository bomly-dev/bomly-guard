#!/usr/bin/env bash
set -euo pipefail

version="$INPUT_VERSION"
if [ "$version" = "latest" ]; then
  echo "Resolving latest Bomly CLI release"
  version="$(gh release view --repo bomly-dev/bomly-cli --json tagName -q '.tagName')"
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
