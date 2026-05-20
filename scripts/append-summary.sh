#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SUMMARY_MD:-}" ]; then
  echo "::warning::Bomly summary path was not provided"
  exit 0
fi
if [ ! -f "$SUMMARY_MD" ]; then
  echo "::warning::Bomly summary file does not exist at $SUMMARY_MD"
  exit 0
fi
if [ -z "${GITHUB_STEP_SUMMARY:-}" ]; then
  echo "::warning::GITHUB_STEP_SUMMARY is not available; skipping job summary"
  exit 0
fi

cat "$SUMMARY_MD" >> "$GITHUB_STEP_SUMMARY"
printf '\n' >> "$GITHUB_STEP_SUMMARY"
echo "Wrote Bomly job summary from $SUMMARY_MD"
