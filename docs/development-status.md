# JL Mixing Studio Development Status

Last updated: 2026-07-26

## Current release

- Latest stable release: `v1.0.0`
- Release status: Released
- Release commit: `1e386586148e8c6faed6d132adad0e93b094f812`
- Supported JL Mixing Automation baseline: `1.3.1`
- Release artifacts: Published and installation-verified

## Release validation

- macOS Intel acceptance: Passed
- Windows x64 limited-scope acceptance: Passed
- Apple Silicon acceptance: Deferred
- CI and release workflow: Passed
- Known release blockers: None

## Current work

Post-v1.0 planning and release follow-up.

## Next work

- Triage bug fixes into the `v1.0.1` milestone.
- Formalize and prioritize the approved `v1.1.0` scope.
- Maintain Studio and Automation with independent product versions.
- Declare compatibility against a specific JL Mixing Automation API version rather than matching Automation release numbers.

## Maintenance strategy

- `main`: active feature development.
- `release/1.0.x`: maintenance line for approved v1.0 patch fixes.
- Patch releases must remain behavior-preserving except for explicitly approved bug fixes.
- Release tags require explicit confirmation.

## Released versions

### v1.0.0 — Initial public release

JL Mixing Studio reached its first stable public release after RC4 acceptance, macOS Intel testing, Windows limited-scope validation, green CI, successful packaging, and verified artifact installation.

## Deferred items

- Apple Silicon acceptance testing.
- Native Windows support in JL Mixing Automation; Studio currently degrades gracefully when Automation is unavailable.
- Post-v1.0 features not yet approved into a specific release scope.

## Known issues and technical debt

No known release-blocking defects. New defects should be recorded as GitHub issues and assigned to either the `v1.0.1` patch milestone or the appropriate future milestone.
