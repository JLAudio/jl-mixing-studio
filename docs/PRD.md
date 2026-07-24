# JL Mixing Studio Product Requirements Document

**Status:** Approved baseline; authoritative delivery inspection current

**Product:** JL Mixing Studio  
**License:** Apache-2.0  
**Functional baseline:** JL Mixing Automation v1.2.0

## 1. Product summary

JL Mixing Studio is an open-source desktop GUI that complements JL Mixing Automation. It is designed for small-studio and home-studio mix engineers who want a clear, guided workflow without losing the portability, transparency, and automation of the command-line system.

The application is studio-aware: it understands the engineer's configured workspace, clients, projects, revisions, approvals, deliveries, and supported defaults. It presents that state visually and guides the user through valid next actions.

## 2. Goals

JL Mixing Studio shall:

1. Make JL Mixing Automation workflows approachable without requiring routine terminal use.
2. Preserve JL Mixing Automation project structures and metadata semantics.
3. Present the current state of a studio, client, project, revision, approval, and delivery clearly.
4. Guide users toward the next valid workflow action.
5. Surface validation findings in plain language with actionable recommendations.
6. Keep user data local and projects understandable without the GUI.
7. Use free or near-free libraries, development tools, CI, packaging, and testing.
8. Support a reproducible development environment suitable for automated code generation and testing.
9. Support macOS and Windows initially.
10. Remain useful to small and home studios without requiring a paid service.

## 3. Non-goals for the initial product

The initial product will not:

- Replace a DAW.
- Host audio plug-ins or process mix audio.
- Store projects in a proprietary database or cloud-only format.
- Require a paid subscription or hosted service.
- Change JL Mixing Automation metadata or lifecycle behavior implicitly.
- Implement multi-user collaboration or remote project synchronization.
- Manage DAW templates or presets outside their DAW-native locations.
- Add archive or project-reactivation behavior unless separately approved.

## 4. Target users

### Primary user

A small-studio or home-studio mix engineer who:

- Manages multiple clients and projects.
- Uses a repeatable mix, revision, approval, and delivery workflow.
- Wants reliable organization without building custom scripts.
- May be uncomfortable with command-line tools.
- Values local control and transparent project files.

### Contributor

An open-source developer who needs clear architecture boundaries, reproducible builds, automated tests, and permissively licensed dependencies.

## 5. Product principles

1. **GUI over automation, not a replacement for it.** JL Mixing Automation remains the functional baseline until functionality is intentionally moved into a shared core.
2. **Project data is the source of truth.** The interface reflects project files and metadata rather than creating a hidden competing state.
3. **Safe by default.** Validate paths and inputs before filesystem changes or process execution.
4. **Explain the next step.** Every workflow screen should make valid next actions obvious.
5. **Preserve portability.** A project must remain inspectable and usable without JL Mixing Studio.
6. **Local first.** Core functionality must not depend on internet access or a paid service.
7. **Accessible and readable.** The interface should favor clarity, keyboard access, and practical studio use over decorative complexity.
8. **No silent compatibility changes.** Metadata or CLI compatibility changes require explicit design approval and tests.

## 6. Initial functional areas

### 6.1 Studio setup and detection

- Locate or create a supported JL Mixing workspace.
- Read studio configuration and defaults.
- Validate required tools and supported JL Mixing Automation version.
- Display setup problems and corrective steps.

### 6.2 Dashboard

- Summarize clients, active work, recent projects, and workflow status.
- Highlight items needing attention.
- Provide direct access to common next actions.

### 6.3 Client management

- List and inspect clients.
- Create clients through supported automation.
- Display client defaults and projects.

### 6.4 Project creation and overview

- Create a mix project using the JL Mixing Automation v1.2.0 rules.
- Display artist, project identity, current revision, approved revision, and delivered revision.
- Link to the underlying project directory.
- Avoid duplicating manifest state in an application-only database.

### 6.5 Intake validation

- Run supported intake validation.
- Present errors, warnings, skipped checks, inventory, mismatches, and recommendations clearly.
- Preserve the non-destructive behavior of validation.
- Provide access to the generated report.

### 6.6 Revisions and approval

- Display revision history and status.
- Create the next revision through supported automation.
- Approve a selected revision using established lifecycle rules.
- Make superseded, approved, and current states visually distinct.

### 6.7 Delivery

- Guide the user through delivery preparation, notes, ZIP creation, and overwrite rules.
- Display the delivered revision.

### 6.8 Settings

- Manage application preferences separately from project metadata.
- Display detected workspace and tool versions.
- Configure approved studio defaults through supported data structures.
- Avoid storing secrets unless a future feature explicitly requires them.

## 7. Compatibility requirements

- JL Mixing Automation v1.2.0 is the initial behavior baseline.
- Repository release versions and metadata schema versions are distinct.
- Metadata schema identities currently remain at 1.1.0.
- Existing `created_with` values must be preserved.
- New GUI behavior must not rewrite metadata merely by opening or inspecting a project.
- CLI failures must be reported without leaving the GUI in a falsely successful state.
- Paths containing spaces must be supported.
- Intel and Apple Silicon macOS builds should be considered in packaging design.
- Windows application builds must be validated in CI and on a real Windows environment before release.
- JL Mixing Automation v1.2.0 supports macOS and Linux, not Windows; Windows must report the CLI as unavailable without crashing unrelated read-only UI.

## 8. Architecture constraints

The accepted architecture is:

- Tauri 2 desktop shell.
- React and TypeScript frontend.
- Rust application and operating-system integration layer.
- Typed commands between the frontend and Rust.
- Restricted command capabilities; no arbitrary shell execution from the frontend.
- JL Mixing Automation invoked as a versioned external dependency during the initial architecture.
- JSON schemas or generated types used to keep Rust and TypeScript models aligned where practical.

ADR-0001 is accepted. The architecture spike passed automated macOS and Windows gates and manual Intel macOS Monterey 12.7.6 validation.

## 9. Quality requirements

- Unit tests for business rules and data parsing.
- Integration tests around JL Mixing Automation invocation.
- Representative fixtures for supported metadata.
- Frontend component tests for important workflow states.
- Automated formatting, linting, type checking, and tests in CI.
- No filesystem mutation in tests outside isolated temporary directories.
- Clear error messages that identify the failed action and safe recovery step.
- Dependencies must be actively maintained and compatible with open-source distribution.
- Paid-only dependencies or services require explicit approval.

## 10. Security and privacy

- Operate locally by default.
- Do not collect telemetry by default.
- Do not execute project-provided commands.
- Validate and constrain all paths received from the frontend.
- Use Tauri capabilities to grant only required permissions.
- Never expose an unrestricted shell interface to the frontend.
- Avoid following untrusted symbolic links during destructive operations.
- Require explicit confirmation for material deletion or overwrite operations.

## 11. Completed milestone: architecture validation

The first implementation milestone delivered a minimal application that:

1. Launches on an Intel Mac running macOS Monterey.
2. Builds on Windows through reproducible CI.
3. Resolves the fixed `new-client` launcher, reads its installation's fixed `VERSION` metadata, runs a restricted `new-client --help` health check, and displays the structured result.
4. Reads a representative JL Mixing Automation v1.2.0 project manifest through Rust and displays selected fields in React.
5. Includes automated tests for version-output handling and manifest parsing.
6. Passes formatting, linting, type checking, tests, and builds in GitHub Actions.
7. Documents setup and reproduction steps.

This milestone was an architecture spike, not the first production release. It is complete and recorded by ADR-0001.

## 12. Completed milestone: read-only workspace discovery and project overview

This completed milestone established the production read path before any project mutation was introduced. The application:

1. Resolve and inspect the default JL Mixing workspace at `~/Music/Mixes`.
2. Read and validate the studio configuration, clients, and project manifests through typed Rust commands.
3. Display workspace health, client and project counts, and project lifecycle summaries.
4. Distinguish healthy, empty, unavailable, invalid, unsupported, and partially valid workspaces.
5. Allow an explicit refresh without restarting the application.
6. Preserve project files as the source of truth and perform no filesystem mutation during discovery.
7. Continue to prohibit arbitrary shell execution and unrestricted frontend filesystem access.
8. Include isolated Rust fixtures and frontend tests for supported states, partial failures, paths containing spaces, historical valid `created_with` values, and non-mutation.
9. Validate the full installed-workspace flow on macOS while retaining Windows CI builds and a graceful unavailable-CLI state on Windows.

Creation or editing of studios, clients, projects, revisions, approvals, deliveries, settings, or other workflow state is outside this milestone. JL Mixing Automation v1.2.0 has no project-completion state, and the GUI must not invent one. The completed scope and acceptance criteria are tracked in [Issue #3](https://github.com/JLAudio/jl-mixing-studio/issues/3).

## 13. Completed milestone: safe automation bridge and guided client creation

This completed milestone introduced the first controlled write workflow while preserving JL Mixing Automation v1.2.0 as the functional baseline. The application:

1. Require a valid healthy or empty default workspace and a detected JL Mixing Automation v1.2.0 installation.
2. Collect only client ID, display name, and optional default artist; all other values inherit studio defaults.
3. Preflight the fixed `new-client` operation with `--dry-run` and no directory-change flag.
4. Require explicit confirmation before invoking `new-client` with `--no-cd`.
5. Construct a fixed executable and separate allowlisted arguments in Rust without a shell.
6. Refresh discovery after success and verify that the new client is present without automatically retrying an uncertain result.
7. Disable the workflow for invalid or partially valid workspaces, missing or unsupported automation, and Windows.
8. Keep the read-only dashboard available when client creation is unavailable.
9. Test command construction through an injected fake runner and keep automated tests isolated from real workspaces.

Studio creation, project creation, client editing or deletion, arbitrary workspace or executable selection, automation installation, and all project lifecycle mutations remain outside this milestone. The completed scope and acceptance criteria are tracked in [Issue #6](https://github.com/JLAudio/jl-mixing-studio/issues/6).

## 14. Completed milestone: application shell and navigation

This completed milestone established the approved product information architecture without adding unsupported workflow behavior. It:

1. Added a persistent JL Mixing Studio shell with a white left navigation pane for Dashboard, Studio, Clients, Projects, Tasks, Reports, Activity Log, and Settings.
2. Established the approved route semantics: Clients represents the client directory and client details, while selected-project screens are project routes with Projects active.
3. Reserved a consistent global-search location on every application screen and presented it as disabled and **Planned** until functional search is implemented.
4. Moved the existing workspace dashboard into the Dashboard route without changing its source-of-truth behavior.
5. Organized the Dashboard around the question **“What do I need to work on today?”**, retaining workflow summary cards, Today’s Work, Studio Health, Quick Actions, and Recent Activity; it populates only supported data and labels deferred content Planned.
6. Preserved guided client creation, including preflight, explicit confirmation, allowlisted execution, and post-create verification.
7. Established reusable layout, navigation, card, table, status, and action patterns based on the approved wireframe.
8. Preserved the original wireframe’s useful screen content and information density wherever it does not contradict approved source-of-truth or capability constraints.
9. Presented honest unavailable states for routes whose data or workflows have not yet been implemented.
10. Preserved keyboard access, readable focus treatment, minimum-window usability, and responsive resizing.
11. Kept JL Mixing Automation v1.2.0 and workspace files authoritative without introducing hidden lifecycle, task, activity, search, completion, or settings state.

The product-level flow is Clients → Client Details → project selection → Project Overview. The Projects directory reaches the same Project Overview route. Client editing remains deferred because JL Mixing Automation v1.2.0 has no client-edit command.

Activity, recommended priorities, and tasks are future functional milestones, but their source rules are approved: Activity is reconstructed only from supported persisted event timestamps, while priorities and tasks are derived from validated project state through one deterministic rule set. They must not create competing GUI-owned state or label a project completed.

`Everything is searchable` is an approved product goal. Future search remains local, read-only, and derived from authoritative workspace data; any cache or index must be rebuildable and non-authoritative. Functional search, ranking, indexing, results, and keyboard behavior remain outside this milestone even though the shell reserves their visual location.

Arbitrary workspace switching, user accounts, a standalone activity database, system storage diagnostics, settings mutation, project creation, and project lifecycle actions remain outside this milestone. The approved design constraints and derivation rules are recorded in [UI architecture](design/UI_ARCHITECTURE.md), and implementation acceptance criteria are tracked in [Issue #8](https://github.com/JLAudio/jl-mixing-studio/issues/8).

## 15. Completed milestone: read-only client and project browsing

This completed milestone made the approved Clients and Projects routes useful while preserving workspace files as the sole source of truth. The application:

1. Lists discovered clients with their IDs, default artists, and project counts.
2. Opens Client Details with the selected client's authoritative summary and projects.
3. Lists projects across clients using the client ID and project ID together as the stable identity.
4. Opens one shared Project Overview route from either Client Details or the Projects directory, with Projects active in primary navigation.
5. Displays authoritative project identity, artist, audio format, metadata version, creation version, and revision state without mutating project files.
6. Continues to expose guided client creation while clearly labeling unsupported actions as Planned.
7. Preserves partial-discovery findings and healthy records together so one invalid manifest does not hide valid clients or projects.
8. Revalidates the selected client or project after refresh and returns safely to its directory if the item no longer exists.
9. Includes frontend tests for both navigation paths, cross-client project identity, partial data, and refresh invalidation.

Client editing, project creation, folder and DAW launch, intake validation, revision creation, approval, delivery, reports, files, and metadata editing remain outside this milestone. The scope and acceptance criteria are tracked in [Issue #11](https://github.com/JLAudio/jl-mixing-studio/issues/11).

## 16. Completed milestone: safe guided project creation

This milestone adds the next controlled write workflow while retaining JL Mixing Automation v1.2.0 as the functional baseline. The application shall:

1. Launch one guided New Project workflow from Client Details or the Projects directory.
2. Select only an existing validated client and collect only the project display name plus an optional artist override.
3. Let JL Mixing Automation derive the stable project ID, inherited artist, audio and delivery defaults, folder structure, and initial Revision 1.
4. Resolve the selected client's working directory internally without accepting a frontend path.
5. Preflight the fixed `new-mix` operation with `--dry-run` and require explicit confirmation before invoking it with `--no-cd`.
6. Construct a fixed executable and separate allowlisted arguments in Rust without a shell.
7. Parse and show the authoritative Automation preview before confirmation.
8. Refresh discovery after success, verify the client/project identity, and open Project Overview.
9. Treat unverified success or transport failures as uncertain and never retry automatically.
10. Disable creation for partial, invalid, empty, or unavailable workspaces, missing or unsupported Automation, and Windows while keeping read-only browsing available.
11. Test command construction with an injected fake runner and cover both UI launch points, validation, cancellation, rejection, success, reconciliation, and uncertain outcomes.

Client editing or deletion, project editing or deletion, intake validation, revision creation or approval, delivery, folder or DAW launch, and arbitrary workspace or executable selection remain outside this milestone. The scope and acceptance criteria are tracked in [Issue #13](https://github.com/JLAudio/jl-mixing-studio/issues/13).

## 17. Completed milestone: guided intake validation

This milestone activates the project Intake route while preserving JL Mixing Automation v1.2.0 and its managed report as authoritative. The application:

1. Resolve a validated project directory internally from its client ID and project ID without accepting a frontend path.
2. Read and parse the existing `00_Admin/Intake_Report.md` managed section, including its explicit not-yet-run state.
3. Preview only the fixed `validate-intake --dry-run` operation from the validated project directory.
4. Use Automation defaults for source, sample rate, bit depth, and duplicate detection without exposing overrides.
5. Treat exit code 5 as a completed report with blocking findings rather than a command failure.
6. Display authoritative counts, findings, source inventory, enhanced-inspection availability, and preparation recommendations.
7. Require explicit confirmation before invoking `validate-intake` with no arguments to update only the managed report section.
8. Re-read and verify the report from disk before reporting a confirmed result.
9. Keep valid existing reports readable in partial workspaces while disabling new validation until workspace issues are resolved.
10. Treat unverified confirmed outcomes as uncertain and never retry automatically.

Custom intake sources, expected-format overrides, disabled duplicate detection, intake-file mutation, automatic conversion, DAW import, revision creation or approval, and delivery remain outside this milestone. The scope and acceptance criteria are tracked in [Issue #15](https://github.com/JLAudio/jl-mixing-studio/issues/15).

## 18. Completed milestone: authoritative revision history

This milestone activated the project Revisions route without introducing a new command or competing state. The application:

1. Preserve revision number, stable revision ID, creation timestamp, description, and paired approval metadata from validated project manifests.
2. Apply semantic consistency checks beyond the released JSON Schema: revision numbers must be unique and contiguous through the current revision, revision IDs must be unique, and approved or delivered pointers must identify a revision with approval metadata.
3. Sort revision history deterministically and distinguish current, approved, delivered, historically approved, and superseded context from authoritative state.
4. Present selected revision details and approval identity only when those values exist in the manifest.
5. Keep valid project revision history readable when a sibling workspace item makes discovery partial.
6. Scan no arbitrary project files, create no application-owned lifecycle state, and perform no filesystem mutation or process execution.
7. Kept revision creation and approval actions disabled and labeled Planned until their exact Automation commands and post-write verification rules were separately approved.

Revision notes-file browsing, revision creation, approval, delivery, folder or DAW launch, and arbitrary manifest editing remain outside this milestone. The scope and acceptance criteria are tracked in [Issue #17](https://github.com/JLAudio/jl-mixing-studio/issues/17).

## 19. Completed milestone: safe guided revision creation

This milestone activates controlled creation of the next project revision while preserving JL Mixing Automation v1.2.0 and the project manifest as authoritative. The application shall:

1. Launch one guided New Revision workflow from Project Overview or the Revisions route.
2. Resolve the selected project's working directory internally from validated client and project IDs without accepting a frontend path.
3. Collect only an optional revision description; Automation derives the next number, stable ID, timestamp, folder, notes template, and default description.
4. Preview only `new-revision [--description TEXT] --dry-run` and require explicit confirmation before invoking `new-revision [--description TEXT] --no-cd`.
5. Construct the fixed executable and separate allowlisted arguments in Rust without a shell.
6. Expose no source-path picker or `--source` argument in this milestone.
7. Re-read authoritative workspace state after success and require exactly one new contiguous revision with a unique ID, unchanged prior records, and unchanged approved and delivered pointers.
8. Open the verified new revision in the existing Revisions route.
9. Treat transport failures or unverifiable confirmed outcomes as uncertain and never retry automatically.
10. Disable creation for partial, invalid, empty, or unavailable workspaces, missing or unsupported Automation, and Windows while keeping validated history readable.
11. Test fixed command construction, input normalization, cancellation, rejection, success, exact reconciliation, and uncertain outcomes.

Revision source import, notes-file browsing, approval, delivery, deletion, editing, folder or DAW launch, and arbitrary manifest changes remain outside this milestone. The scope and acceptance criteria are tracked in [Issue #19](https://github.com/JLAudio/jl-mixing-studio/issues/19).

## 20. Completed milestone: safe guided revision approval

This milestone activates controlled approval of a selected project revision while preserving JL Mixing Automation v1.2.0 and the project manifest as authoritative. The application shall:

1. Launch one guided **Approve revision** workflow for the revision selected in the Revisions route.
2. Resolve the selected project's working directory internally from validated client and project IDs without accepting a frontend path.
3. Collect only an approver identity, defaulting to `Client`; the selected manifest revision supplies the revision number.
4. Preview only `approve-mix --revision NUMBER --approved-by NAME --dry-run` and require explicit confirmation before invoking `approve-mix --revision NUMBER --approved-by NAME`.
5. Use Automation's execution timestamp and expose no project path, `--date`, notes, delivery option, executable, shell string, or arbitrary argument.
6. Warn before approving an older revision, replacing its historical approval metadata, or leaving an existing delivery on a different revision.
7. Disable approval when the selected revision is already the approved revision.
8. Re-read authoritative workspace state after success and require the approved pointer and selected approval metadata to match Automation while project identity, audio settings, revision identity and content, non-selected records, current revision, and delivered revision remain unchanged.
9. Treat transport failures or unverifiable confirmed outcomes as uncertain and never retry automatically.
10. Disable approval for partial, invalid, empty, or unavailable workspaces, missing or unsupported Automation, and Windows while keeping validated history readable.
11. Test fixed command construction, input normalization, cancellation, rejection, success, exact reconciliation, already-approved state, historical reapproval, older-revision warnings, and uncertain outcomes.

Delivery creation, approval timestamp override, revision notes or file editing, source import, deletion, arbitrary paths, and manifest editing remain outside this milestone. The scope and acceptance criteria are tracked in [Issue #21](https://github.com/JLAudio/jl-mixing-studio/issues/21).

## 21. Completed milestone: authoritative delivery readiness and package inspection

This milestone activates the Delivery route without running `create-delivery` or introducing competing lifecycle state. The application shall:

1. Validate the released v1.2.0 delivery-manifest schema locally and offline.
2. Require a delivery manifest and `state.delivered_revision` to exist together.
3. Correlate delivery client, project, revision identity, and description with the containing validated manifests while preserving approval metadata as an immutable package-time snapshot.
4. Reject duplicate or unsafe recorded file paths while preserving valid sibling projects during partial discovery.
5. Present approval-required, ready-for-first-delivery, current-delivery, and replacement-review-required states.
6. Display delivery identity, creation provenance, method, revision, approval, file count, total bytes, deliverable types, relative paths, and recorded SHA-256 values.
7. Explain that recorded checksums are not recalculated during discovery.
8. Keep package creation, ZIP creation, filters, overwrite, destructive clean replacement, notes editing, transfer, and deletion disabled and Planned.
9. Perform no filesystem mutation or process execution.

The scope and acceptance criteria are tracked in [Issue #23](https://github.com/JLAudio/jl-mixing-studio/issues/23).

## 22. Completed milestone: safe guided first-delivery creation

This milestone activates controlled creation of a project's first authoritative delivery package while retaining Automation v1.2.0 as the sole package writer. The application shall:

1. Enable creation only for a validated project with an approved revision and no existing delivery manifest or delivered pointer.
2. Preview only `create-delivery --dry-run` from the internally resolved project directory.
3. Parse and display the approved revision, delivery method, selected file names, classifications, destinations, exclusions, and lifecycle update.
4. Require explicit confirmation before invoking `create-delivery` with no arguments from the same validated directory.
5. Expose no project path, include/exclude patterns, working-prefix override, ZIP, overwrite, clean replacement, source, or destination controls.
6. Re-discover the workspace after success and require the delivered pointer and validated delivery manifest to identify the previously approved revision.
7. Require client/project identity, current and approved pointers, revision history, and unrelated project metadata to remain unchanged.
8. Require the created manifest's recorded paths and classifications to match the confirmed plan.
9. Treat stale state, existing packages, rejection, and unsupported environments as blocked without mutation.
10. Treat an unreconciled reported success as uncertain and never retry it automatically.

The scope and acceptance criteria are tracked in [Issue #25](https://github.com/JLAudio/jl-mixing-studio/issues/25).

## 23. Current milestone: derived priorities, tasks, and activity

This milestone activates one read-only derivation layer shared by Dashboard priorities, Tasks, and Activity. It preserves schema-validated client/project creation timestamps and project deadlines; derives recovery, overdue, delivery, upcoming-deadline, and revision-review tasks in the approved deterministic order; and reconstructs activity only from persisted client, project, revision, approval, and delivery timestamps. Refresh rebuilds every item without a database, cache, completion flag, event log, process execution, or workspace mutation. Activity is explicitly a derived persisted-event feed, not a complete audit log. The scope is tracked in [Issue #28](https://github.com/JLAudio/jl-mixing-studio/issues/28).

## 24. Approved JL Mixing Studio 1.0 scope boundary

Dashboard Quick Actions shall expose the existing guided New Client and New Project workflows. Intake validation remains project-scoped and shall not appear as a Dashboard quick action.

JL Mixing Studio 1.0 may use only the released JL Mixing Automation v1.2.0 command and metadata contracts. Features that require changes to the Automation v1.2.0 codebase are outside Studio 1.0. Not every existing Automation option must be exposed. Guided `new-studio`, editable Delivery Notes, delivery ZIP/overwrite, and destructive clean replacement are required Studio 1.0 workflows; clean replacement requires a dry-run deletion preview, explicit destructive confirmation, validated internal path resolution, exact post-operation reconciliation, and no automatic retry after an uncertain result.

### 24.1 Studio overview and guided setup

The Studio route reads validated `studio.json` data and displays studio identity, configured root, creation provenance, engineer, audio defaults, delivery defaults, default requested deliverables, directory-change setting, and detected Automation compatibility. When the fixed `~/Music/Mixes` workspace is absent, Studio may invoke only Automation v1.2.0 `new-studio` with name, optional engineer, supported sample rate, bit depth, and WAV/AIFF format. Preflight adds `--dry-run`; confirmation adds `--no-default-cd`. The application accepts no custom root, executable, or arguments and must re-discover and reconcile the created studio before reporting success. Existing, partial, or invalid workspaces block setup; uncertain results are never retried automatically. This scope is tracked in [Issue #31](https://github.com/JLAudio/jl-mixing-studio/issues/31).

### 24.2 Validated folder navigation

Studio displays selectable, copyable paths and may open only internally resolved workspace, studio, client, project, intake, revisions, and delivery directories in the operating-system file browser. The frontend supplies a location kind and stable client/project identities, never an arbitrary path or executable. Rust re-discovers the workspace, resolves validated identities, canonicalizes the existing directory, and requires it to remain within the canonical workspace root before invoking the platform folder opener. This scope is tracked in [Issue #32](https://github.com/JLAudio/jl-mixing-studio/issues/32) and supersedes Issue #27.

### 24.3 Reports, Files, and Metadata

The global Reports route indexes validated delivery manifests and links back to stable project identities. Project Reports combines the authoritative intake report and validated delivery manifest; Files lists only file records already present in those supported reports; Metadata displays the schema-validated project summary. These views do not crawl project directories, invent modification timestamps, parse unsupported documents, or create a second metadata source. This scope is tracked in [Issue #33](https://github.com/JLAudio/jl-mixing-studio/issues/33).

## 25. Future decisions requiring approval

- Minimum supported Windows version.
- Long-term minimum macOS version.
- Long-term React component-library strategy beyond the approved application-shell patterns.
- Whether to bundle JL Mixing Automation or require a separate installation.
- Shared-core strategy between the CLI and GUI.
- Release signing, notarization, and update distribution.
- Telemetry or crash reporting, if any.
- Public release roadmap and versioning policy.
