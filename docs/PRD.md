# JL Mixing Studio Product Requirements Document

**Status:** Approved baseline; application shell complete; read-only client and project browsing current
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

## 15. Current milestone: read-only client and project browsing

This milestone makes the approved Clients and Projects routes useful while preserving workspace files as the sole source of truth. The application shall:

1. List discovered clients with their IDs, default artists, and project counts.
2. Open Client Details with the selected client's authoritative summary and projects.
3. List projects across clients using the client ID and project ID together as the stable identity.
4. Open one shared Project Overview route from either Client Details or the Projects directory, with Projects active in primary navigation.
5. Display authoritative project identity, artist, audio format, metadata version, creation version, and revision state without mutating project files.
6. Continue to expose guided client creation while clearly labeling client editing, project creation, search, and project workflow actions as Planned.
7. Preserve partial-discovery findings and healthy records together so one invalid manifest does not hide valid clients or projects.
8. Revalidate the selected client or project after refresh and return safely to its directory if the item no longer exists.
9. Include frontend tests for both navigation paths, cross-client project identity, partial data, and refresh invalidation.

Client editing, project creation, folder and DAW launch, intake validation, revision creation, approval, delivery, reports, files, and metadata editing remain outside this milestone. The scope and acceptance criteria are tracked in [Issue #11](https://github.com/JLAudio/jl-mixing-studio/issues/11).

## 16. Future decisions requiring approval

- Minimum supported Windows version.
- Long-term minimum macOS version.
- Long-term React component-library strategy beyond the approved application-shell patterns.
- Whether to bundle JL Mixing Automation or require a separate installation.
- Shared-core strategy between the CLI and GUI.
- Release signing, notarization, and update distribution.
- Telemetry or crash reporting, if any.
- Public release roadmap and versioning policy.
