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
- Release scope: **Frozen**.
- Primary objective: Release the completed Automation API `1.0` integration and behavior-preserving Studio refactor without adding new Studio workflow/UI feature scope.
- Coordinated provider release: JL Mixing Automation `v1.4.0`.
- Certified integration baseline: Studio `v1.1.0` acceptance-tested against Automation `v1.4.0` using Automation API `1.0`.
- Versioning policy: Studio and Automation retain independent product versions. Studio declares compatibility with a specific Automation API version/capability set rather than requiring matching product release numbers.
- Studio v1.1 Automation API target: `1.0`.
- Cross-repository provider dependency: JL Mixing Automation API `1.0` contract work is complete, including the workflow parity extensions required by Studio.

## v1.1 scope freeze

In scope for `v1.1.0`:

- the existing Studio v1.0 workflow feature set;
- Automation API `1.0` discovery, compatibility, capability handling, and structured workflow integration;
- the completed Rust/frontend maintainability refactors;
- regression fixes required to preserve existing supported behavior;
- coordinated RC and packaged acceptance testing with Automation `v1.4.0`.

Explicitly deferred beyond `v1.1.0`:

- exposing additional Automation options that are not already present in the Studio UI;
- broader UI/wireframe redesign;
- new Automation API capabilities beyond the approved v1.4/API 1.0 provider contract;
- DAW/template-management features;
- signing/notarization;
- unrelated feature or architectural work.

During RC acceptance, only defects/regressions and release-blocking fixes are in scope.

## Release validation

- macOS Intel acceptance: Passed for v1.0; fresh v1.1 packaged acceptance required.
- Windows x64 limited-scope acceptance: Passed for v1.0; fresh v1.1 packaged acceptance required.
- Apple Silicon acceptance: Deferred for v1.0; v1.1 manual acceptance remains conditional on available hardware.
- CI and release workflow: Current development CI passed; fresh RC release workflows required.
- Known v1.1 release blockers: None before RC acceptance.
- Coordinated acceptance source of truth: `docs/v1.1-v1.4-coordinated-acceptance.md`.

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

- Prepare coordinated Automation `v1.4.0` and Studio `v1.1.0` release candidates from the frozen scope.
- Execute the coordinated acceptance matrix in `docs/v1.1-v1.4-coordinated-acceptance.md`.

## Next work

- Build and validate an Automation v1.4 RC using the Automation release gates.
- Build and validate a Studio v1.1 RC using the Studio release workflow.
- Run packaged API-integration, end-to-end workflow, refactor-regression, and platform acceptance tests.
- Fix only confirmed defects/regressions found during RC acceptance, rerun affected tests, and cut a new RC when required.
- Release Automation v1.4.0 and Studio v1.1.0 only after explicit final approval.

## Maintenance strategy

- `main`: active feature development outside an active RC freeze; during v1.1 RC acceptance, changes are limited to approved release fixes/documentation.
- `release/1.0.x`: maintenance line for approved v1.0 patch fixes.
- Patch releases must remain behavior-preserving except for explicitly approved bug fixes.
- Release tags require explicit confirmation.

## Released versions

### v1.0.0 — Initial public release

JL Mixing Studio reached its first stable public release after RC4 acceptance, macOS Intel testing, Windows limited-scope validation, green CI, successful packaging, and verified artifact installation.

## Deferred items

- Apple Silicon acceptance testing when suitable hardware is unavailable.
- Native Windows support in JL Mixing Automation; Studio currently degrades gracefully when Automation is unavailable.
- Native Windows platform enablement after the Automation API foundation.
- Missing Automation-backed Studio UI features, including additional client/project/intake/revision/delivery options, for post-v1.1 planning.
- Broader UI refinement toward the approved wireframes for post-v1.1 planning.
- New Automation API capabilities beyond the v1.4/API 1.0 release baseline.
- Signing/notarization and other post-v1.0 distribution hardening unless separately approved.

## Known issues and technical debt

- Legacy approval and delivery regression support remains intentionally test-only until all remaining parser-era assertions have explicit structured API equivalents.
- No known release-blocking defects. New RC defects must be recorded as GitHub issues and classified against the coordinated acceptance matrix.
