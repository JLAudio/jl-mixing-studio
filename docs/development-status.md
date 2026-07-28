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
- Cross-repository dependency: JL Mixing Automation owns the provider contract and machine-readable API declaration in `JLAudio/jl-mixing#44`. Studio owns its consumer policy and integration in `JLAudio/jl-mixing-studio#74` through `#77`.

## Release validation

- macOS Intel acceptance: Passed
- Windows x64 limited-scope acceptance: Passed
- Apple Silicon acceptance: Deferred
- CI and release workflow: Passed
- Known release blockers: None

## Current work

Plan and implement the `v1.1.0` Automation API integration foundation across the two products.

Automation-owned provider work:

- Define and publish the stable Automation API contract.
- Expose the Automation API version through a machine-readable interface.
- Document the supported operations and structured error behavior consumed by Studio.

Studio-owned consumer work:

- Define the Automation API version supported by Studio v1.1 and the consumer compatibility policy.
- Introduce a Studio-side Automation API abstraction layer.
- Centralize Automation discovery, API-version validation, and compatibility handling.
- Improve missing, malformed, unavailable, and incompatible Automation error handling.
- Add integration tests for supported and rejected Automation API versions.

## Next work

- Review and approve the Automation provider-contract scope in `JLAudio/jl-mixing#44`.
- Review and approve the Studio consumer scope in issues `#74` through `#77`.
- Implement the provider contract before or in coordination with the Studio consumer boundary.
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
