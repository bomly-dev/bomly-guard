# Contributing

Thanks for contributing to Bomly Guard.

By participating in this project you agree to abide by the Bomly
[Code of Conduct](https://github.com/bomly-dev/.github/blob/main/CODE_OF_CONDUCT.md).
To report a security vulnerability, follow the
[Security Policy](https://github.com/bomly-dev/.github/blob/main/SECURITY.md)
rather than opening a public issue.

## Development

This repository contains a composite GitHub Action implemented with shell and Node.js scripts.

Run the local checks before opening a pull request:

```bash
npm run lint:shell
npm run lint:js
npm test
```

## Pull Requests

- Keep changes focused.
- Update `README.md` when changing action inputs, outputs, examples, or behavior.
- Add or update tests when changing ref resolution or CLI argument mapping.
- Use clear commit messages such as `fix: use PR merge base` or `docs: document analyzer input`.

## Releases

The release workflow runs when a tag matching `v*.*.*`, such as `v1.0.0`, is pushed. It validates the action, creates or updates the matching GitHub Release, and moves the major tag, such as `v1`, to the same commit for Marketplace users.

After each automated release, confirm the new version appears on the Marketplace listing; if it does not, edit the GitHub Release and check "Publish this Action to the GitHub Marketplace."

Create release tags from an up-to-date `main` branch:

```bash
git checkout main
git pull
git tag v1.0.0
git push origin v1.0.0
```

GitHub can also create a tag from the Releases UI by drafting a new release, choosing a new tag such as `v1.0.0`, targeting `main`, and publishing the release. The local `git tag` flow is preferred because the workflow owns release creation and keeps the exact release tag and major tag in sync.

The release workflow also supports manual dispatch with a `tag` input. Manual dispatch is intended for rerunning release automation for an existing tag; it does not create a new tag because the workflow checks out the provided tag before publishing.
