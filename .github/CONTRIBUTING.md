# Contributing

Thank you for your interest in improving Time Tracker!

## Reporting bugs

Please open a GitHub Issue and include:

- What you expected to happen
- What actually happened
- The error message from Apps Script logs (View -> Logs)
- Your Toggl plan (Free / Starter / Premium)
- Whether you are using Script Properties or hardcoded credentials

Do **not** include your API token or any credentials in the issue.

## Suggesting features

Open a GitHub Issue with the label `enhancement`. Describe the use case, not just the solution — it helps evaluate the right approach.

## Submitting a pull request

1. Fork the repository and create a branch from `main`
1. Make your changes in `Code.gs`
1. Update `CHANGELOG.md` under an `[Unreleased]` heading
1. If you change any CONFIG options, update the configuration table in `README.md`
1. Open a pull request with a clear description of what changed and why

## Code style

- Use `var` for variable declarations (Google Apps Script V8 supports `const`/`let`, but `var` maximizes compatibility with older script runtimes)
- Keep functions focused — one responsibility per function
- Add a comment block header to every new function
- Log meaningful messages via `Logger.log()` so users can follow execution in the Apps Script log viewer
- Never log or expose credentials

## Questions

Open a GitHub Discussion or Issue — all questions are welcome.
