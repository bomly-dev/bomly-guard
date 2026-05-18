# bomly-review-action

`bomly-review-action` runs `bomly diff --enrich --audit --format json` for pull requests, merge queues, or explicitly supplied refs and exposes review-oriented outputs for dependency, vulnerability, license, denied-package, and suspicious-package changes.

The action intentionally wraps the CLI rather than reimplementing graph logic. It mirrors the most useful `dependency-review-action` inputs while adding Bomly-specific typo protection inputs: `protected-packages`, `typosquat-threshold`, and `typosquat-mode`.

## Parity notes

Supported now:

- pull request, pull request target, merge group, and explicit ref inference
- severity, scope, license, vulnerability allowlist, package deny, and warning policy inputs
- local and external config files
- job summaries, idempotent PR comments, and machine-readable outputs
- patched-version summary plumbing when CLI payloads expose `fixed_in`

Still outside the local-ref execution model:

- snapshot warning retries, because Bomly does not call GitHub's dependency review snapshot API
- OpenSSF Scorecard display
- literal API parity with GitHub's dependency review REST flow
