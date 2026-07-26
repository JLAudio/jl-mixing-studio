# JL Mixing Studio Roadmap

**Status:** Proposed for review

## Product role

JL Mixing Studio is the desktop user experience for the JL Mixing ecosystem. JL Mixing Automation remains authoritative for workflow rules and filesystem mutations. Workspace files and supported metadata remain authoritative for project state.

## Versioning and compatibility

Studio versions independently from JL Mixing Automation. Each Studio release declares:

- the supported Automation API range;
- required and optional API capabilities;
- supported metadata schema versions.

Studio 1.0 remains based on the exact released Automation 1.3.0 command contract. Adoption of Automation API 1.0 is a post-1.0 transition and must not be implied retroactively.

## Post-1.0 roadmap themes

### Compatibility foundation

- Detect the installed Automation application, API, schema support, and capabilities.
- Replace exact application-version gating with API-range and capability checks.
- Present clear missing, outdated, incompatible, and partially capable states.
- Add contract tests using released Automation API fixtures.

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
