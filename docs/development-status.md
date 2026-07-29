# JL Mixing Studio Development Status

Last updated: 2026-07-29

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

Complete the `v1.1.0` Studio consumer migration to Automation API `1.0` while preserving v1.0 user-visible behavior.

Automation-owned provider work:

- Automation API `1.0` discovery and workflow contract completed in `JLAudio/jl-mixing#44`.
- Provider capabilities available to Studio: `system.info`, `client.create`, `project.create`, `revision.create`, `intake.validate`, `revision.approve`, and `delivery.create`.
- `delivery.create` rich result parity extension completed by Automation #66 / PR #67, including authoritative selected/excluded file data and clean-deletion inventory required by Studio.

Studio-owned consumer work completed:

- Compatibility policy documented and implemented (#74).
- Centralized Automation discovery, API-version validation, capability handling, and stable error mapping implemented (#76).
- Studio-side Automation API invocation boundary established under #75.
- `client.create`, `project.create`, `revision.create`, `intake.validate`, and `revision.approve` migrated to the structured API boundary.
- CLI runtime refactored into domain-focused modules (`studio`, `client`, `project`, `intake`, `revision`, and `delivery`) under #85 / PR #94.

Studio-owned consumer work in progress:

- Migrate `delivery.create` from the legacy `create-delivery` output parser to Automation API `delivery.create` (#75), consuming the richer provider result from Automation PR #67.
- Preserve clean-replacement confirmation safety by revalidating the exact provider deletion inventory before destructive execution.
- Add deterministic Automation API compatibility/integration tests for supported and rejected API behavior (#77).

## Next work

- Complete and merge the `delivery.create` API migration.
- Complete #75 once all Automation-backed Studio workflows use the abstraction layer.
- Complete #77 compatibility and failure-path integration coverage and remove temporary legacy test adapters.
- Continue UI refinement toward the approved wireframes after the API foundation is stable.
- Run the existing-code JL Audio coding-standards audit tracked by #93 after the current API/refactor sequence stabilizes.

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

- Legacy approval and delivery regression tests remain isolated behind test-only support while the structured API paths are covered independently; remove the legacy test support when #77 consolidates API integration coverage.
- No known release-blocking defects. New defects should be recorded as GitHub issues and assigned to either the `v1.0.1` patch milestone or the appropriate future milestone.
