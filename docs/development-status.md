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
- Primary objective: Build on the completed Automation API `1.0` foundation with behavior-preserving maintainability cleanup and approved UI refinement.
- Versioning policy: Studio and Automation retain independent product versions. Studio declares compatibility with a specific Automation API version rather than requiring matching product release numbers.
- Studio v1.1 Automation API target: `1.0`.
- Cross-repository provider dependency: JL Mixing Automation API `1.0` contract work is complete, including the `delivery.create` parity extension required by Studio.

## Release validation

- macOS Intel acceptance: Passed
- Windows x64 limited-scope acceptance: Passed
- Apple Silicon acceptance: Deferred
- CI and release workflow: Passed
- Known release blockers: None

## Completed v1.1 foundation work

Automation-owned provider work:

- Automation API `1.0` discovery and workflow contract completed in `JLAudio/jl-mixing#44`.
- Provider capabilities available to Studio: `system.info`, `client.create`, `project.create`, `revision.create`, `intake.validate`, `revision.approve`, and `delivery.create`.
- `delivery.create` rich result parity extension completed by Automation #66 / PR #67, including authoritative selected/excluded file data and clean-deletion inventory required by Studio.

Studio-owned consumer work:

- Compatibility policy documented and implemented (#74).
- Studio-side Automation API abstraction layer completed (#75).
- Centralized Automation discovery, API-version validation, capability handling, and stable error mapping completed (#76).
- Deterministic Automation API compatibility and failure-path coverage completed (#77 / PR #97).
- `client.create`, `project.create`, `revision.create`, `intake.validate`, `revision.approve`, and `delivery.create` migrated to the structured API boundary.
- Delivery clean-replacement confirmation revalidates the exact provider deletion inventory immediately before destructive execution (PR #96).
- CLI runtime refactored into domain-focused modules (`studio`, `client`, `project`, `intake`, `revision`, and `delivery`) under #85 / PR #94.

## Current work

Run the existing-code JL Audio coding-standards audit tracked by #93 now that the API/refactor sequence is stable.

Initial audit findings and focused follow-up work:

- #98: split the oversized `src-tauri/src/cli/tests.rs` regression test module into domain-focused modules without dropping coverage.
- #99: split the oversized `src/App.tsx` React application module into cohesive route/workflow modules without changing user-visible behavior.
- Keep legacy approval and delivery regression adapters test-only until equivalent structured API coverage fully replaces every remaining assertion, including ZIP naming and input-validation cases.

## Next work

- Implement #98 first as the lower-risk behavior-preserving standards cleanup.
- Implement #99 in focused extraction PRs rather than one oversized React rewrite.
- Continue UI refinement toward the approved wireframes after structural cleanup has reduced the cost and risk of frontend changes.
- Complete #93 once material standards deviations are corrected or explicitly documented with maintainability rationale.

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

- Legacy approval and delivery regression support remains intentionally test-only until all remaining parser-era assertions have explicit structured API equivalents; track final removal under #93/#98.
- No known release-blocking defects. New defects should be recorded as GitHub issues and assigned to either the `v1.0.1` patch milestone or the appropriate future milestone.
