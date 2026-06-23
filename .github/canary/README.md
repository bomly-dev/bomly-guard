# Bomly Guard Canary

The Guard canary runs from the central `bomly-dev/bomly-guard` repository and verifies selected demo pull requests across example repositories.

It requires a `BOMLY_CANARY_TOKEN` secret with access to the selected example repositories. The token needs permission to read pull requests, read/write Actions workflow runs for reruns, read issue comments, read check runs, and read code scanning alerts.

The canary intentionally validates Guard plumbing instead of exact vulnerability counts:

- the selected PR workflow completed with the expected conclusion
- the Bomly PR comment exists and contains expected finding categories
- the `bomly` code-scanning check exists
- code-scanning alerts point at changed dependency manifest or lockfile lines

Update `targets.json` when demo PR numbers change or when vulnerability database drift changes expected outcomes.
