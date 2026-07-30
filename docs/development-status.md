# JL Mixing Studio Development Status

Last updated: 2026-07-30

## Current release

- Latest stable release: `v1.0.0`
- Release status: Released
- Release commit: `1e386586148e8c6faed6d132adad0e93b094f812`
- Supported JL Mixing Automation baseline: `1.3.1`
- Release artifacts: Published and installation-verified

## Active development target

- Target release: `v1.1.0`
- Primary objective: Build on the completed Automation API `1.0` foundation with approved UI refinement and incremental feature work.
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
- CLI runtime refactored into domain-focused modules under #85 / PR #94.
- Tunable frontend presentation copy centralized into the typed `src/resources/copy.ts` domain resource layer under #134 / PRs #138–#142.
- Frontend source reorganized around product-domain ownership under #137 / PRs #143–#166, including domain-owned workflow UI, models, views, shell policy, and workflow controllers with `App.tsx` reduced to composition and cross-domain orchestration.

## Coding-standards audit

The existing-code JL Audio coding-standards audit tracked by #93 is complete.

Completed structural and test work includes:

- CLI regression tests split into domain-focused modules (#98 / PR #109).
- Frontend application decomposition and test-support cleanup (#99, #110, #111 / PRs #105, #114–#119).
- Workspace tests and discovery responsibilities split/refined (PRs #120–#121).
- Domain models decomposed and normalized by layer (PRs #122, #129–#130).
- `lib.rs` reduced to its Tauri composition-root role, with command/workflow ownership extracted (PRs #123–#131).
- Remaining oversized Automation compatibility discovery function decomposed without changing API `1.0` behavior (PR #132).
- Final code-comment sweep confirmed coverage for destructive-operation safety, uncertainty/no-retry rules, platform behavior, compatibility/version independence, workspace path validation, and non-obvious persistence behavior.

Intentional maintainability exceptions:

- `workspace.rs` remains above the ~500-line review threshold because workspace discovery, schema validation, validated identity/path resolution, and failure mapping form one cohesive boundary; oversized tests were already split out and no remaining production function exceeds the strong-refactor threshold.
- `delivery_legacy_testsupport.rs` remains test-only compatibility scaffolding and includes a >100-line legacy parser. It is intentionally not decomposed further because it will be removed once every remaining parser-era regression assertion has structured Automation API coverage.
- `revision_legacy_testsupport.rs` remains test-only for the same compatibility purpose and is within normal size thresholds.

## Frontend domain ownership

The v1.1 frontend domain refactor tracked by #137 is complete:

- Product implementation now lives under explicit `client/`, `project/`, `intake/`, `revision/`, `approval/`, `delivery/`, `studio/`, `settings/`, `shell/`, `resources/`, and `ui/` ownership.
- Workflow state machines and Tauri operation handling are owned by domain controller hooks rather than `App.tsx`.
- `App.tsx` remains the composition root for routing, selection state, shared workspace/version discovery, and deliberate cross-domain coordination.
- Former top-level App buckets such as `AppWorkflows.tsx`, `AppProjectViews.tsx`, `AppWorkflowModels.ts`, `AppWorkflowAvailability.ts`, and `AppRouteContext.ts` no longer own large implementations. Where retained, they are small compatibility/re-export surfaces rather than architectural ownership boundaries.
- `AppViews.tsx` remains a minimal compatibility barrel over shell and domain views. It can be removed opportunistically if direct imports provide a concrete maintenance benefit; its current two-line form is not an implementation bucket.
- `types.ts` intentionally remains centralized for stable cross-domain Automation/Tauri request, result, workspace, and serialized-data contract types. Domain-specific UI/workflow state belongs with the owning domain instead of being added there.
- Preview/confirm/commit behavior, uncertainty/no-retry handling, Tauri command names, filesystem semantics, and serialized/API contracts were preserved throughout the refactor.

## Copy and operational-message ownership

JL Mixing Studio uses a deliberate resource boundary for user-facing wording:

- Tunable frontend presentation text belongs in the typed, domain-oriented `src/resources/copy.ts` resource layer. Components reference resource keys rather than owning headings, labels, guidance, confirmation language, empty-state wording, and other copy expected to evolve.
- Automation operation names, capability identifiers, schema/version identifiers, serialized field names, command/flag names, and filesystem contract literals remain in the domain code that owns those contracts. They are not presentation resources.
- Rust operation result enums such as `*OperationCode` are the stable machine-facing error/operation contract. Their accompanying message is a human-readable fallback, not a parsing contract.
- Rust fallback wording remains owned by the corresponding domain workflow or adapter (`src-tauri/src/workflows/*_workflow.rs` and related CLI boundary code). Exact shared messages should be consolidated when they represent the same semantic condition; domain-specific wording should remain with its owning workflow rather than being forced into a global string table.
- Frontend code should map stable operation/error codes to product copy when practical. Rust-provided messages remain available for unmapped, degraded, or diagnostic fallback paths.
- Future localization should evolve the typed frontend resource layer rather than moving machine/API contract strings into localization resources.

## Current work

- Continue v1.1 UI refinement and approved feature work from the domain-oriented frontend architecture and typed copy/resource boundary.

## Next work

- Continue UI refinement toward the approved wireframes.
- Add future Automation API capabilities using stable domain/layer ownership and consistent CRUD-oriented operation naming as those contracts evolve.
- Remove legacy CLI parser test support when equivalent structured API coverage exists for every remaining assertion.

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

- Legacy approval and delivery regression support remains intentionally test-only until all remaining parser-era assertions have explicit structured API equivalents.
- No known release-blocking defects. New defects should be recorded as GitHub issues and assigned to either the `v1.0.1` patch milestone or the appropriate future milestone.
