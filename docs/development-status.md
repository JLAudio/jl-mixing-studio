# JL Mixing Studio Development Status

Last updated: 2026-07-27

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

## Release validation

- macOS Intel acceptance: Passed
- Windows x64 limited-scope acceptance: Passed
- Apple Silicon acceptance: Deferred
- CI and release workflow: Passed
- Known release blockers: None

## Current work

Plan and implement the `v1.1.0` Automation API integration foundation.

Initial work includes:

- Define the supported Automation API version and compatibility policy.
- Introduce a Studio-side Automation API abstraction layer.
- Centralize Automation discovery, version negotiation, and compatibility validation.
- Improve missing and incompatible Automation error handling.
- Add integration tests for supported and rejected Automation API versions.

## Next work

- Review and approve the detailed `v1.1.0` issue scope.
- Implement the Automation API abstraction layer behind existing Studio workflows.
- Replace remaining direct CLI and shell coupling where the approved API contract permits it.
- Preserve current user-visible behavior unless a change is explicitly approved.
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
