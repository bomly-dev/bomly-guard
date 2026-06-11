<p align="center">
  <img src="assets/bomly-dependency-review-action-wordmark.svg" alt="Bomly Dependency Review Action" width="420">
</p>

<p align="center">
  <strong>Review Dependency Drift Before It Lands.</strong>
</p>

<p align="center">
  <a href="https://github.com/bomly-dev/bomly-dependency-review-action/actions/workflows/ci.yml"><img src="https://github.com/bomly-dev/bomly-dependency-review-action/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/bomly-dev/bomly-dependency-review-action"><img src="https://api.scorecard.dev/projects/github.com/bomly-dev/bomly-dependency-review-action/badge" alt="OpenSSF Scorecard"></a>
  <a href="https://github.com/bomly-dev/bomly-dependency-review-action/releases/latest"><img src="https://img.shields.io/github/v/release/bomly-dev/bomly-dependency-review-action?sort=semver" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/bomly-dev/bomly-dependency-review-action" alt="License: Apache-2.0"></a>
</p>

`bomly-dependency-review-action` installs the Bomly CLI and runs `bomly diff` for pull requests, merge queues, or explicitly supplied refs.

The action is a composite wrapper around the CLI. Dependency analysis and Markdown summary rendering come from `bomly diff`; the action handles GitHub Actions plumbing such as CLI installation, PR merge-base inference, outputs, job summaries, optional pull request comments, and optional SARIF upload.

## Usage

```yaml
name: Bomly Dependency Review

on:
  pull_request:

permissions:
  actions: read
  contents: read
  pull-requests: write
  issues: write
  security-events: write

jobs:
  dependency-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: bomly-dev/bomly-dependency-review-action@v1
        with:
          fail-on: high
          comment-summary-in-pr: on-failure
```

On pull requests, the action compares the PR head against the PR merge base unless `base-ref` is set. This keeps review focused on dependency changes introduced by the PR instead of changes already present on the target branch.

For Marketplace and CI stability, pin to a major tag such as `@v1` or to an exact release tag such as `@v1.2.3`.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `version` | `latest` | Bomly CLI release to install, such as `latest`, `v0.4.6`, or `0.4.6`. |
| `repo-token` | `${{ github.token }}` | Token for current-repository API access, pull request comments, and repository security checks. |
| `cli-repo-token` | `${{ github.token }}` | Token for reading Bomly CLI releases. |
| `log-level` | `verbose` | Bomly CLI log level: `quiet`, `verbose`, or `debug`. |
| `base-ref` | inferred | Base git ref to compare. Pull requests use the PR merge base when this is not set. |
| `head-ref` | inferred | Head git ref to compare. Pull requests use the PR head SHA when this is not set. |
| `config-file` | | Local Bomly config path or `owner/repo/path@ref` external config reference. |
| `external-repo-token` | `repo-token` | Token for private external config repositories. |
| `enrich` | `true` | Passes `--enrich` when `true`. |
| `audit` | `true` | Passes `--audit` when `true`; SARIF side output is generated only when audit is enabled. |
| `analyze` | `false` | Passes `--analyze` when `true` for reachability analysis. |
| `fail-on` | | Comma-separated values passed as repeated `--fail-on` constraints. |
| `allow-licenses` | | Comma-separated SPDX values passed as repeated `--allow-license`. |
| `deny-licenses` | | Comma-separated SPDX values passed as repeated `--deny-license`. |
| `license-exempt-packages` | | Comma-separated package URLs passed as repeated `--license-exempt-package`. |
| `allow-vulnerability-ids` | | Comma-separated vulnerability IDs passed as repeated `--allow-vulnerability-id`. |
| `deny-packages` | | Comma-separated package URLs passed as repeated `--deny-package`. |
| `deny-groups` | | Comma-separated package URL namespaces passed as repeated `--deny-group`. |
| `protected-packages` | | Comma-separated package names passed as repeated `--protected-package`. |
| `typosquat-threshold` | | Value passed to `--typosquat-threshold`. |
| `typosquat-mode` | | Value passed to `--typosquat-mode`; Bomly accepts `warn` or `fail`. |
| `warn-only` | `false` | Passes `--warn-only` when `true`. |
| `ecosystems` | | Selector string passed to `--ecosystems`. |
| `detectors` | | Selector string passed to `--detectors`. |
| `matchers` | | Selector string passed to `--matchers`. |
| `auditors` | | Selector string passed to `--auditors`. |
| `analyzers` | | Selector string passed to `--analyzers`. |
| `install-first` | `false` | Passes `--install-first` when `true`. |
| `install-args` | | Comma-separated values passed as repeated `--install-arg`. |
| `comment-summary-in-pr` | `never` | Pull request comment mode: `never`, `always`, or `on-failure`. |
| `upload-sarif` | `auto` | SARIF upload mode: `auto`, `true`, or `false`. `auto` skips upload cleanly when code scanning is unavailable. |

The action always owns `bomly diff --format json` and its Markdown/SARIF side outputs so GitHub outputs, job summaries, PR comments, and code scanning upload remain stable. The CLI flags `--format`, `--json`, `--output`, and `--interactive` are intentionally not action inputs.

## Outputs

- `comment-content`: Markdown summary content.
- `dependency-changes`: JSON dependency diff.
- `vulnerable-changes`: introduced vulnerability findings.
- `invalid-license-changes`: introduced license findings.
- `denied-changes`: introduced denied package findings.
- `suspicious-package-changes`: introduced suspicious package findings.
- `sarif-file`: path to the generated SARIF file when audit is enabled.

## SARIF Upload

SARIF upload uses `github/codeql-action/upload-sarif` when supported. GitHub requires `security-events: write`, and private repositories also require `actions: read` plus GitHub Code Security enabled. The default `upload-sarif: auto` skips upload cleanly when those requirements are not met; Bomly policy evaluation still controls the final action result.

## Configuration

`config-file` accepts either a local path or an external config reference in the form `owner/repo/path@ref`. External config reads use `external-repo-token` when set, otherwise `repo-token`.

For the full Bomly CLI configuration reference, see the [Bomly CLI docs](https://github.com/bomly-dev/bomly-cli).
