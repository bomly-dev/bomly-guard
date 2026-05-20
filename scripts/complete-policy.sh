#!/usr/bin/env bash
set -euo pipefail

if [ "$EXIT_CODE" -ne 0 ]; then
  echo "Bomly policy failed with exit code ${EXIT_CODE}"
  exit "$EXIT_CODE"
fi
echo "Bomly policy passed"
