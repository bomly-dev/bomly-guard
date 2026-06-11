# Contributing

Thanks for contributing to Bomly Dependency Review Action.

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
