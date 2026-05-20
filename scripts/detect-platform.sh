#!/usr/bin/env bash
set -euo pipefail

case "${RUNNER_OS}-${RUNNER_ARCH}" in
  Linux-X64) os="linux"; arch="amd64"; ext="tar.gz"; binary="bomly" ;;
  Linux-ARM64) os="linux"; arch="arm64"; ext="tar.gz"; binary="bomly" ;;
  macOS-X64) os="darwin"; arch="amd64"; ext="tar.gz"; binary="bomly" ;;
  macOS-ARM64) os="darwin"; arch="arm64"; ext="tar.gz"; binary="bomly" ;;
  Windows-X64) os="windows"; arch="amd64"; ext="zip"; binary="bomly.exe" ;;
  Windows-ARM64) os="windows"; arch="arm64"; ext="zip"; binary="bomly.exe" ;;
  *)
    echo "::error::Unsupported platform: ${RUNNER_OS}-${RUNNER_ARCH}"
    exit 1
    ;;
esac

echo "Bomly platform: ${os}/${arch} (${ext})"
{
  echo "os=$os"
  echo "arch=$arch"
  echo "ext=$ext"
  echo "binary=$binary"
} >> "$GITHUB_OUTPUT"
