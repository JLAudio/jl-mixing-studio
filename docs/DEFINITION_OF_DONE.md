# Definition of Done

A change is done when all applicable conditions below are satisfied.

## Scope and design

- The change matches an approved issue, PR scope, or documented decision.
- Product behavior changes are reflected in the PRD or an architecture decision record when appropriate.
- Existing approved product and JL Mixing Automation compatibility decisions are preserved.
- Out-of-scope work is deferred rather than silently included.

## Implementation

- Code is understandable, maintainable, and separated by responsibility.
- Frontend code does not bypass the typed Tauri command boundary.
- Filesystem paths, external input, and command arguments are validated.
- Destructive or overwrite behavior is explicit and safely handled.
- No paid-only dependency or service is introduced without approval.
- New dependencies have compatible licenses and a clear purpose.

## Testing

- New behavior has proportionate automated tests.
- Bug fixes include a regression test when practical.
- Tests use isolated temporary data and do not mutate real user projects.
- Formatting, linting, type checking, unit tests, integration tests, and builds pass.
- Platform-specific behavior is tested on the affected platform.

## Documentation

- User-facing behavior and setup changes are documented.
- Architecture or compatibility decisions are recorded.
- Error and recovery behavior is clear.
- Comments explain intent where code alone is insufficient.

## Pull request

- Work is performed on a feature branch.
- The PR explains the change, rationale, impact, and validation.
- CI passes.
- Review feedback is addressed.
- The PR contains no unrelated changes.
- The branch is current enough with `main` to merge safely.

## Release readiness

When a change affects a release artifact:

- Package contents are verified.
- License and attribution obligations are satisfied.
- macOS and Windows artifacts are tested as applicable.
- Signing and notarization status is documented.
- Versioning and release notes are correct.
