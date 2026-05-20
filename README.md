# bomly-review-action

`bomly-review-action` installs the Bomly CLI and runs `bomly diff --enrich --audit --format json` for pull requests, merge queues, or explicitly supplied refs.

The action is a composite wrapper around the CLI. Dependency analysis and Markdown summary rendering come from `bomly diff`; the action handles GitHub Actions plumbing such as CLI installation, ref inference, outputs, job summaries, and optional pull request comments.

## Usage

```yaml
name: Bomly Review

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  bomly-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: bomly-dev/bomly-review-action@v1
        with:
          fail-on-severity: high
          comment-summary-in-pr: on-failure
```

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `version` | `latest` | Bomly CLI release to install, such as `latest`, `v0.4.6`, or `0.4.6`. |
| `repo-token` | `${{ github.token }}` | Token for GitHub API access and release lookup. |
| `base-ref` / `head-ref` | inferred | Explicit refs to compare outside pull request or merge group events. |
| `config-file` | | Local Bomly config path or `owner/repo/path@ref` external config reference. |
| `external-repo-token` | `repo-token` | Token for private external config repositories. |
| `fail-on-severity` | | Passed to `bomly diff --fail-on`. |
| `fail-on-scopes` | | Comma-separated values passed as repeated `--fail-on-scope`. |
| `allow-licenses` / `deny-licenses` | | Comma-separated SPDX policy values. |
| `allow-dependencies-licenses` | | Comma-separated package URLs exempt from license policy. |
| `allow-ghsas` | | Comma-separated vulnerability IDs to allow. |
| `deny-packages` / `deny-groups` | | Comma-separated package URL deny policy values. |
| `protected-packages` | | Comma-separated canonical package names for typo protection. |
| `typosquat-threshold` / `typosquat-mode` | | Suspicious package policy tuning. |
| `warn-only` | `false` | Passes `--warn-only` when `true`. |
| `comment-summary-in-pr` | `never` | One of `never`, `always`, or `on-failure`. |

## Outputs

- `comment-content`: Markdown summary content.
- `dependency-changes`: JSON dependency diff.
- `vulnerable-changes`: introduced vulnerability findings.
- `invalid-license-changes`: introduced license findings.
- `denied-changes`: introduced denied package findings.
- `suspicious-package-changes`: introduced suspicious package findings.

## Parity notes

Supported:

- pull request, pull request target, merge group, and explicit ref inference
- severity, scope, license, vulnerability allowlist, package deny, and warning policy inputs
- local and external config files
- job summaries, idempotent PR comments, and machine-readable outputs
- patched-version summary display when CLI payloads expose `fixed_in`
