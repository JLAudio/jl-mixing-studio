# JL Mixing Studio Development Status

Last updated: 2026-07-28

## Current release

- Latest stable release: `v1.0.0`
- Release status: Released
- Release commit: `1e386586148e8c6faed6d132adad0e93b094f812`
- Supported JL Mixing Automation baseline: `1.3.1`
- Release artifacts: Published and installation-verified

## Active development target

- Target release: `v1.1.0`
- Primary objective: Establish the JL Mixing Automation API as the stable compatibility contract between Studio and Automation.
- Versioning policy: Studio and Automation retain independent product versions. Studio declares compatibility with a specific Automation API version rather than requiring matching product release numbers.
- Studio v1.1 Automation API target: `1.0`.
- Cross-repository dependency: JL Mixing Automation provider contract `JLAudio/jl-mixing#44` is complete. Studio owns its consumer policy and integration in `JLAudio/jl-mixing-studio#74` through `#77`.

## Release validation

- macOS Intel acceptance: Passed
- Windows x64 limited-scope acceptance: Passed
- Apple Silicon acceptance: Deferred
- CI and release workflow: Passed
- Known release blockers: None

## Current work

Implement the `v1.1.0` Studio consumer integration for Automation API `1.0`.

Automation-owned provider work:

- Automation API `1.0` discovery and workflow contract completed in `JLAudio/jl-mixing#44`.
- Provider capabilities available to Studio: `system.info`, `client.create`, `project.create`, `revision.create`, `intake.validate`, `revision.approve`, and `delivery.create`.

Studio-owned consumer work:

- Define and document the Studio v1.1 Automation API `1.0` compatibility policy (#74).
- Introduce a Studio-side Automation API abstraction layer (#75).
- Centralize Automation discovery, API-version validation, and compatibility handling (#76).
- Improve missing, malformed, unavailable, incompatible, and missing-capability error handling.
- Add integration tests for supported and rejected Automation API versions (#77).

## Next work

- Complete and merge the Studio consumer compatibility policy in #74.
- Implement the Automation API abstraction layer in #75.
- Implement centralized discovery and API-version validation in #76.
- Add deterministic compatibility integration tests in #77.
- Migrate existing Automation-backed Studio workflows to the API boundary while preserving v1.0 user-visible behavior.
- Continue UI refinement toward the approved wireframes after the API foundation is stable.

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
- Native Windows platform enablement after the Automation API foundation.
- Broader UI and workflow enhancements not yet approved into a specific release scope.
- Post-v1.0 features requiring Automation behavior beyond the approved API contract.

## Known issues and technical debt

No known release-blocking defects. New defects should be recorded as GitHub issues and assigned to either the `v1.0.1` patch milestone or the appropriate future milestone.
