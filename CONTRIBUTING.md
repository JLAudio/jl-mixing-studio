# Contributing to JL Mixing Studio

Thank you for helping build JL Mixing Studio.

## Before starting

- Review the [PRD](docs/PRD.md), architecture decisions, and [Definition of Done](docs/DEFINITION_OF_DONE.md).
- Discuss material product or architecture changes before implementation.
- Use an issue for work that changes behavior or requires a design decision.
- Do not change established JL Mixing Automation behavior implicitly.

## Branch workflow

Do not commit directly to `main`.

Create a focused branch from the current `main`:

```text
feature/short-description
fix/short-description
docs/short-description
```

Automated development agents may use:

```text
agent/short-description
```

Open a draft pull request early for non-trivial work. Keep each PR focused on one reviewed scope.

## Development principles

- Prefer free and open-source dependencies.
- Ask before adding paid services or paid-only tooling.
- Keep project data local and transparent.
- Treat JL Mixing Automation project files and metadata as the source of truth.
- Validate paths and external command arguments.
- Never expose arbitrary shell execution to the frontend.
- Preserve compatibility unless a change is explicitly approved.

## Commit and pull-request expectations

Use concise commit messages that describe the result. Pull requests should explain:

- What changed.
- Why it changed.
- User or developer impact.
- Tests and validation performed.
- Known limitations or follow-up work.

Complete the pull-request template and satisfy the Definition of Done before requesting final review.

## Licensing

By contributing, you agree that your contributions will be licensed under Apache-2.0.
