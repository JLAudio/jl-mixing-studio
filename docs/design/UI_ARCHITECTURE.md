# JL Mixing Studio UI architecture

**Status:** Approved design direction  
**Approved:** July 17, 2026  
**Implementation milestone:** [Issue #8](https://github.com/JLAudio/jl-mixing-studio/issues/8)  
**Functional baseline:** JL Mixing Automation v1.2.0

![JL Mixing Studio revised product wireframe](./jl-mixing-studio-wireframe-rev2.svg)

## Purpose

This document records the approved information architecture and visual direction for JL Mixing Studio. The wireframe is the product-level target, not authorization to implement every displayed value or action immediately.

Implementation remains incremental. Every screen, count, status, and action must be backed by an approved source-of-truth mapping before it becomes functional.

## Approved design direction

The following patterns are approved:

- A persistent white sidebar with a subtle divider, dark text, and a pale-blue active state paired with the light primary content area.
- JL Mixing Studio branding throughout the application shell.
- Primary navigation for Dashboard, Studio, Clients, Projects, Tasks, Reports, Activity Log, and Settings.
- A visible current-workspace context in the shell.
- A consistent global-search location reserved in the shell on every application screen, presented as clearly disabled and planned until search is implemented.
- Contextual search and filtering areas for collection-oriented Clients, Projects, Tasks, Reports, and Activity views.
- Project-centered navigation through Overview, Intake, Revisions, Delivery, Reports, Files, and Metadata.
- Clear page headings, compact summary cards, readable tables, explicit status treatments, and prominent next actions.
- A recommended-next-step pattern that explains the safest valid workflow action.
- Primary, secondary, warning, success, and unavailable action states with consistent meaning.
- Responsive desktop behavior that remains usable at the supported minimum window size.

The wireframe is a layout and interaction reference. Exact copy, sample values, dates, people, versions, spacing, and colors may change during accessible implementation.

## Navigation hierarchy

The primary navigation and nested workflow routes have distinct responsibilities:

1. **Clients** opens the client directory.
2. Selecting a client opens **Client Details**, which presents validated `client.json` fields and that client's projects.
3. Selecting a project from Client Details opens the same **Project Overview** route used by the cross-client Projects directory.
4. Project Overview and the project workflow tabs are project routes. **Projects**, not Clients, remains the active primary navigation item.
5. A breadcrumb may preserve the originating client context without changing the active project route.

Client modification is not implied by the Client Details screen. JL Mixing Automation v1.2.0 has no client-edit command, so editing requires a separately approved safe workflow.

## Screen inventory

| Screen | Intended responsibility | Implementation status |
| --- | --- | --- |
| Dashboard | Summarize authoritative workspace and workflow state and expose common next actions | Existing workspace overview will move into the shell |
| Studio | Display studio identity, configured defaults, workspace information, and approved diagnostics | Future milestone |
| Clients | List clients and enter approved client workflows | Guided creation exists; client directory is future work |
| Client Details | Present validated client defaults and the client's projects; enter a selected project | Future milestone; client editing is not yet supported |
| Projects | Search, filter, and inspect projects using derived lifecycle state | Future milestone |
| Project Overview | Present project identity, lifecycle state, revisions, and recommended next action as a project route with Projects active | Future milestone |
| Intake | Run and present non-destructive validation | Future milestone |
| Revisions | Present revision history and approved revision actions | Future milestone |
| Delivery | Present delivery readiness and approved delivery actions | Future milestone |
| Tasks | Derive actionable work from authoritative project state | Approved derivation rules; future milestone |
| Reports | Present generated reports without duplicating their state | Future milestone |
| Activity Log | Present the supported activity that can be reconstructed from authoritative timestamps | Approved derived source; future milestone |
| Settings | Separate application preferences from approved studio configuration changes | Future milestone |

## Source-of-truth rules

JL Mixing Automation v1.2.0 and the files in the selected JL Mixing workspace remain the functional and data baseline.

| Wireframe concept | Required source or rule |
| --- | --- |
| Client and project counts | Derived from validated workspace discovery |
| Current, approved, and delivered revisions | Derived from supported project manifests |
| Active, awaiting approval, needs delivery, and other workflow labels | Must have an explicitly documented derivation from supported metadata |
| Recommended priorities | Highest-ranked derived tasks, with the reason for each ranking displayed |
| Tasks | Derived view only; no competing application-only task state |
| Recent activity | Derived only from supported persisted creation, revision, approval, and delivery timestamps |
| Tool health | Restricted Rust diagnostics with fixed executable and argument allowlists |
| Workspace identity | Current approved workspace resolution; arbitrary selection is not implied |
| Settings | Application preferences or supported studio structures, kept distinct |
| Open-folder and DAW actions | Restricted operating-system capabilities with validated paths |
| Search | Future local, read-only queries over validated workspace data and approved derived views; any cache or index must be rebuildable and non-authoritative |
| Engineer name | Local studio metadata or application preference; not a user account |

Opening or inspecting a workspace must not rewrite project metadata. The interface must not report a successful mutation until the underlying operation and subsequent state verification succeed.

## Derived activity, recommended priorities, and tasks

These three views use one read-only derivation layer over validated workspace data. They do not introduce a database, task file, completion flag, or hidden GUI-owned workflow state.

### Activity

The supported activity feed is reconstructed from persisted timestamps that identify a specific event:

- client creation from client `metadata.created_at`;
- project creation from project `metadata.created_at`;
- revision creation from each revision `created_at`;
- revision approval from `approval.approved_at`; and
- delivery creation from delivery-manifest `metadata.created_at`.

Events sort newest first with deterministic project and event-type tie-breakers. Generic `last_modified_at`, file access, report viewing, failed commands, cancelled commands, and actions that leave no authoritative timestamp are not activity events. The view must state that it is a derived project-event feed, not a complete audit log.

### Recommended priorities

The Dashboard shows the highest-ranked actionable project conditions and explains the rule that produced each item. The ranking is:

1. invalid or unreadable workspace data requiring recovery;
2. an overdue deadline for a project whose revision state is not fully aligned as `current_revision == approved_revision == delivered_revision`;
3. an approved revision whose number differs from `delivered_revision`;
4. the nearest future deadlines for projects whose revision state is not fully aligned as `current_revision == approved_revision == delivered_revision`; and
5. a current revision whose number differs from `approved_revision`, described as requiring review without implying that it is ready for approval.

Within the same class, items sort by deadline when available, then client name, project name, and stable project ID. A project with `current_revision == approved_revision == delivered_revision` may be omitted from deadline priorities, but it must not be labeled completed.

### Tasks

The Tasks screen exposes the full derived action list produced by the same conditions:

- resolve a workspace recovery issue;
- review an overdue or approaching project deadline;
- create or update delivery for the approved revision; or
- review a newer unapproved current revision.

Tasks have no manual completion checkbox in v1.0. They disappear or change when refreshed authoritative state no longer produces the condition. The Dashboard may show a smaller top-ranked subset, but both views must use the same derivation and ordering rules.

## Wireframe corrections and deferred assumptions

The following sample elements are not approved product behavior as drawn:

- The product name is **JL Mixing Studio**, not JL Mixing Automation. JL Mixing Automation is the compatible external automation system.
- The Studio application version and the JL Mixing Automation compatibility version are separate. The sample `v2.0.0 (Preview)` label is not an approved release version.
- JL Mixing Automation v1.2.0 has no project-completion state. JL Mixing Studio must not invent completed-project counts or completion status.
- The goal is that all supported workspace information is searchable. Functional search, query ranking, indexing, and keyboard behavior remain separately reviewed work; the shell only reserves a clearly planned search surface.
- Arbitrary workspace switching, user accounts, multi-user activity, system storage diagnostics, editable studio defaults, and unrestricted settings changes require separate approval.
- Project Overview is reached after project selection from either Client Details or Projects; Projects remains the active primary route.
- The Clients route requires a client directory and Client Details screen before it can represent the approved product flow.
- Derived Activity is limited to the specific persisted events defined above and must not imply a complete audit trail.
- Tasks and Dashboard priorities use the single approved derivation and ordering rules above.
- Screen controls must not imply that an unsupported operation is available. Use explicit unavailable or planned states instead.
- Windows must remain usable for supported read-only behavior when JL Mixing Automation v1.2.0 is unavailable.

## Search design goal

**Everything is searchable** is an approved product goal. The architecture must preserve room for search even while functional search remains deferred.

- The application shell reserves one consistent global-search location on every application screen.
- Until search is implemented, the affordance is disabled and explicitly labeled **Planned**; it must not accept input or imply that results are available.
- Clients, Projects, Tasks, Reports, and Activity also reserve contextual search or filtering within their collection views.
- Future searchable sources may include validated client and project metadata, supported revision and delivery state, approved derived Tasks and Activity, generated report content, and validated workspace file names as those capabilities are reviewed.
- Search remains local, offline-capable, and read-only. It must not require a hosted or paid service.
- If a cache or index is introduced, it is disposable and completely rebuildable from authoritative workspace files. It must never become a competing source of truth.
- Exact query syntax, ranking, indexing strategy, result navigation, keyboard shortcuts, and performance limits require a focused implementation milestone.

## Application shell milestone

[Issue #8](https://github.com/JLAudio/jl-mixing-studio/issues/8) is limited to the shared shell and navigation foundation:

1. Build the persistent white sidebar and route structure.
2. Reserve the consistent disabled **Search — Planned** surface without implementing queries, indexing, or results.
3. Move the existing workspace dashboard into the Dashboard route.
4. Preserve guided client creation and all current safety constraints.
5. Establish reusable layout, navigation, card, table, status, and action styles.
6. Provide honest unavailable states for routes that are not implemented.
7. Do not add new workflow state, broad filesystem access, arbitrary command execution, functional search, or unsupported mutations.

The shell milestone does not implement the complete ten-screen wireframe.

## Accessibility and responsive requirements

- All navigation and actions must be operable with a keyboard.
- Active navigation must be exposed programmatically and not rely on color alone.
- Focus must remain visible against both the dark sidebar and light content area.
- Status must use text or icons in addition to color.
- Tables must retain meaningful reading order and provide a usable narrow-window treatment.
- Dialog focus, Escape behavior, pending-operation protection, and confirmation semantics from guided client creation must be preserved.
- Content must remain readable at the supported minimum window size without hiding required actions.
- Motion must not be required to understand state changes.
- Text and interactive controls must meet practical contrast and target-size expectations.

## Change control

This document records the approved direction. Material changes to navigation, source-of-truth behavior, lifecycle terminology, or the safety boundary require review before repository implementation. Individual screens and write workflows should be proposed through focused issues and feature-branch pull requests.
