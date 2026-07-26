# JL Mixing Studio Roadmap

**Status:** Approved design; not yet implemented

## Product role

JL Mixing Studio is the desktop user experience for the JL Mixing ecosystem. JL Mixing Automation remains authoritative for workflow rules and filesystem mutations. Workspace files and supported metadata remain authoritative for project state.

## Versioning and compatibility

Studio versions independently from JL Mixing Automation. Each Studio release declares:

- the supported Automation API range;
- required and optional API capabilities;
- supported metadata schema versions.

Studio 1.0 remains based on the exact released Automation 1.3.0 command contract. Adoption of Automation API 1.0 is a post-1.0 transition and must not be implied retroactively.

## Approved capability model

`system.info` is the only globally required Automation capability for Studio API mode. It provides the API version, Automation application version, metadata schema support, and capability list needed for compatibility evaluation.

The initial feature-capability set is:

- `studio.create`;
- `client.create`;
- `project.create`;
- `intake.validate`;
- `revision.create`;
- `revision.approve`;
- `delivery.create`.

A missing feature capability disables only the corresponding Studio workflow. Studio remains usable for supported read-only workspace operations and any workflows whose capabilities are present. The first API-enabled Studio release reports four installation states: compatible with full functionality, compatible with limited functionality, incompatible, and Automation unavailable.

All seven feature capabilities constitute the full-functionality baseline for the first API-enabled Studio release.

## Approved compatibility-declaration lifecycle

`compatibility.json` is a version-controlled build-time release declaration. It defines the Studio release's supported Automation API range, metadata schema versions, globally required capabilities, feature capabilities, and full-functionality baseline.

Release builds validate the declaration, confirm that its Studio version matches the application release, and bundle it as a read-only application resource. Production builds do not load a user-editable compatibility policy from the working directory or user data directory.

At runtime Studio combines the bundled declaration with `jl-mixing system-info --json` to derive the current compatibility state. The discovered state is runtime data, not configuration.

Compatibility-policy changes require a reviewed source change, compatibility tests, and a new Studio release. Studio does not download or silently replace compatibility policy at runtime. Tests and development builds may inject controlled fixtures without changing the production resource model.

## Approved Automation API cutover policy

Studio 1.0.x remains tied to the exact JL Mixing Automation 1.3.0 command contract. The first Studio release that adopts Automation API 1.0 makes a clean cutover to the `jl-mixing` dispatcher and removes the legacy integration path for individual human-facing executables.

The API-enabled release does not fall back to `new-studio`, `new-client`, `new-mix`, `validate-intake`, `new-revision`, `approve-mix`, or `create-delivery`. This avoids maintaining two request, response, error, progress, and reconciliation models and prevents unsafe fallback after an uncertain mutation.

The cutover occurs only after:

1. Automation API 1.0 is implemented and released;
2. all seven existing Studio feature capabilities are available and contract-tested;
3. Studio has dispatcher-based implementations for every existing Automation-backed workflow;
4. success, planned, blocked, error, and supported progress-event contracts are tested;
5. post-operation authoritative-state reconciliation remains in place;
6. compatibility and upgrade messaging is complete; and
7. end-to-end migration tests cover the Studio 1.0 and Automation 1.3.0 baseline.

An API-enabled Studio release encountering Automation 1.3.0 or another installation without `system.info` classifies Automation API mode as incompatible or unavailable. Safe read-only workspace access may remain available, but Automation-backed mutation actions are disabled until a compatible API implementation is installed.

The exact Studio release number for the cutover is assigned during release planning rather than fixed by this roadmap.

## Approved Windows support policy

Windows readiness remains a continuous architecture, implementation, and CI requirement. Platform-neutral code must avoid assumptions about POSIX paths, shells, executable locations, permissions, or operating-system UX. Windows builds, Rust and frontend tests, graceful unavailable-Automation behavior, and packaging smoke tests continue throughout the Automation API compatibility milestone.

Full Windows workflow support is the next committed milestone after Automation API 1.0 adoption and before search, navigation, and reporting expansion. Studio does not implement Windows mutation workflows against the legacy Automation 1.3.0 command contract.

The Windows milestone requires:

1. a compatible native Windows implementation of Automation API 1.0;
2. discovery through `jl-mixing system-info --json`;
3. all seven existing Studio workflow capabilities;
4. matching preflight, confirmation, execution, structured-result, progress, and authoritative-state reconciliation behavior;
5. correct handling of Windows paths, drive letters, known folders, spaces, file opening, and folder opening;
6. native Windows packaging and upgrade validation; and
7. end-to-end validation on a real Windows environment in addition to CI.

Official Windows support targets native Windows operation. WSL may be useful for development or experimentation but is not the required end-user execution model.

Windows ecosystem support is coordinated across repositories. A parent design issue defines the shared platform contract, with separate Automation and Studio implementation issues. Automation owns its Windows API implementation, filesystem and external-tool behavior, packaging, and contract tests. Studio owns Windows platform integration, compatibility presentation, operating-system UX, packaging, and end-to-end validation.

## Approved post-1.0 priority sequence

1. **Compatibility foundation** — adopt Automation API 1.0, replace exact Automation 1.3.0 application-version gating, add capability checks, validate structured responses and progress events, and preserve authoritative-state reconciliation.
2. **Windows platform enablement** — deliver native Windows support for the complete existing workflow after a compatible Windows Automation API implementation is available.
3. **Search and navigation** — add global search, recent projects, favorites, filters, saved local views, and keyboard navigation after the API and Windows platform foundations are complete.
4. **Reporting and workflow polish** — improve project summaries, reports, workflow views, progress presentation, notifications, errors, and drag-and-drop entry points.
5. **New cross-product capabilities** — consider project-health checks, batch operations, file watching, templates, persisted tasks, backup, recall, asset, and inventory features only through separately approved API or schema designs.

The compatibility foundation and Windows platform enablement are the first two committed post-1.0 milestones. Later roadmap items remain candidates until separately approved and assigned to a release milestone.

## Post-1.0 roadmap themes

### Compatibility foundation

- Detect the installed Automation application, API, schema support, and capabilities.
- Replace exact application-version gating with API-range and capability checks.
- Present clear missing, outdated, incompatible, and partially capable states.
- Add contract tests using released Automation API fixtures.

### Windows platform enablement

- Preserve Windows CI and platform-neutral implementation throughout API adoption.
- Integrate with the native Windows Automation API implementation.
- Enable the complete existing Studio workflow capability set on Windows.
- Validate Windows path, process, filesystem, WebView, notification, and operating-system UX behavior.
- Build and test native Windows installers and upgrades.
- Complete real-machine end-to-end acceptance testing before release.

### Workflow usability

Mostly Studio-owned work that should not require new workflow semantics:

- functional global search over authoritative workspace data;
- recent projects and favorites stored as local presentation state;
- richer filtering and saved local views;
- keyboard shortcuts and navigation improvements;
- clearer progress, cancellation boundaries, notifications, and errors;
- drag-and-drop entry points that call existing supported Automation operations;
- background execution queues without automatic retry after uncertain mutations.

### Reporting and visibility

- printable project summaries;
- improved intake, revision, approval, and delivery views;
- exportable reports derived from validated metadata and reports;
- library statistics and project-status summaries;
- project-health presentation backed by Automation-owned checks when new checks are required.

### Advanced workflows

Candidates requiring explicit API review:

- batch intake and validation;
- batch project operations;
- file watching and change detection;
- project templates beyond existing Automation defaults;
- structured project health checks;
- task and deadline workflows that require new persisted state.

### Studio-aware future

Longer-term candidates include session intelligence, recall management, asset management, backup awareness, studio inventory, and optional client-facing delivery workflows. Each must pass the feature-ownership test before design.

## Ownership boundaries

Studio owns presentation, local UI preferences, rebuildable indexes, and operating-system UX. Automation owns workflow rules, validation, project writes, and stable API behavior. Persisted cross-product information requires an approved metadata schema change.

## Release planning

Roadmap items are candidates until approved. A release milestone contains only approved issues. Cross-repository features use a parent design issue plus separate Studio and Automation implementation issues.

## Features intentionally outside scope

Studio should not become a DAW, accounting package, general CRM, mandatory cloud service, or independent replacement for Automation workflow logic.