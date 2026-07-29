from pathlib import Path

# Triggered after the branch-local workflow exists so this one-time codemod runs reliably.
replacements = {
    Path("src/AppViews.tsx"): {
        "Valid clients and projects remain available below.": "Your available clients and projects are still here below.",
        "Workspace not found": "Your studio workspace isn’t ready yet",
        "Install JL Mixing Automation and run <code>new-studio</code> to create the default workspace.": "Set up your studio workspace to get started.",
        "Configuration problem": "Something doesn’t look right",
        "The workspace cannot be read safely": "We can’t read this studio setup yet",
        "Review the issue details before trying again.": "Check the details below, then try again.",
        "Workspace ready": "You’re ready to go",
        "No clients or projects yet": "Your studio is ready for its first client",
        "Use <strong>New client</strong> to create the first client safely.": "Choose <strong>New client</strong> when you’re ready to get started.",
        "Recovery guidance": "A few things to check",
        "Validated workspace clients": "Clients in your studio",
        "Validated project manifests": "Projects in your studio",
        "Workspace discovery failed": "We couldn’t open your studio workspace",
        "Today’s work": "On deck",
        "Recommended priorities": "What needs your attention",
        "No derived actions need attention.": "Nothing needs your attention right now.",
        "Refresh rebuilds priorities from authoritative state.": "Refresh anytime to check for new work.",
        "Start safely": "Start something new",
        "Persisted project events": "What’s been happening",
        "No supported persisted events found.": "No recent project activity yet.",
        "Only validated creation, revision, approval, and delivery timestamps appear here.": "New clients, projects, revisions, approvals, and deliveries will show up here.",
        "Only validated clients and projects are shown.": "The clients and projects we can read are still available.",
        "Deriving tasks…": "Checking what needs attention…",
        "Tasks could not be derived": "We couldn’t load your tasks",
        "Authoritative workspace": "Studio work",
        "No derived tasks": "Nothing needs your attention",
        "No validated condition currently requires attention.": "You’re all caught up for now.",
        "Derived on refresh": "Updated when you refresh",
        "Tasks have no manual completion state or application-owned database.": "Tasks are based on the current state of your studio and projects.",
        "Deriving activity…": "Loading recent activity…",
        "Activity could not be derived": "We couldn’t load recent activity",
        "Persisted timestamps": "Recent studio activity",
        "No supported activity events": "No recent activity yet",
        "No validated event timestamps are available.": "Project activity will appear here as work moves forward.",
        "Derived event feed": "Activity history",
        "This is not a complete audit log. It includes only timestamps persisted by JL Mixing Automation.": "This view shows supported project milestones recorded by JL Mixing Automation.",
        "Validated workspace": "Your studio",
        "Authoritative metadata": "Project details",
        "Workflow controls": "Keep the project moving",
        "Reading the Automation-managed report from the validated project.": "Reading the latest intake report for this project.",
        "Preview the default Automation validation before updating the managed report section.": "Preview the intake check before updating the report.",
        "The project manifest does not contain a revision yet.": "This project doesn’t have a revision yet.",
        "Authoritative record": "Revision details",
        "Details come from <code>00_Admin/project-manifest.json</code>. No project files were scanned or changed.": "These details come from the project record. No project files were scanned or changed.",
        "Authoritative files": "Project files",
        "No files are recorded by supported authoritative reports.": "No files are recorded in the available project reports.",
        "Validated report index": "Studio reports",
        "Delivery manifests are indexed from validated workspace state. Intake reports remain available from each project's Reports tab.": "Delivery reports are collected here. Intake reports are available from each project’s Reports tab.",
        "No validated delivery reports are recorded.": "No delivery reports yet.",
        "Authoritative package state": "Delivery status",
        "Studio found no validated delivery manifest for this project.": "No delivery package has been created for this project yet.",
        "Manifest record": "Delivery details",
        "Checksums are the values recorded and verified by JL Mixing Automation when this package was created. Studio did not re-hash delivery files.": "JL Mixing Automation recorded and verified these checksums when the package was created. Studio did not re-check the delivery files.",
        "Validated studio": "Your studio",
        "Review the validated discovery issues below before changing the workspace.": "Check the setup issues below before making changes.",
    },
    Path("src/App.tsx"): {
        "Workspace and automation checks must finish first.": "Finishing the studio checks first…",
        "The validated studio workspace already exists.": "Your studio workspace is already set up.",
        "Resolve the existing workspace issue before setup.": "Fix the studio setup issue before continuing.",
        "Preview and confirm creation of the default ~/Music/Mixes workspace.": "Review the setup, then create your studio workspace at ~/Music/Mixes.",
        "Resolve workspace issues before creating a client.": "Fix the studio setup issues before adding a client.",
        "Preview and confirm a new client using JL Mixing Automation v1.3.1.": "Review the client details, then add them to your studio.",
        "Resolve workspace issues before creating a project.": "Fix the studio setup issues before starting a project.",
        "Preview and confirm a new project using JL Mixing Automation v1.3.1.": "Review the project details, then create it.",
        "The existing report remains readable, but workspace issues must be resolved before validation can run.": "You can still read the current report, but fix the studio setup issues before running intake again.",
        "Preview the Automation v1.3.1 defaults, then confirm the managed report update.": "Preview the intake check, then update the report when everything looks right.",
        "Revision history remains readable, but workspace issues must be resolved before creating a revision.": "You can still read the revision history, but fix the studio setup issues before creating a new revision.",
        "Preview and confirm the next revision using JL Mixing Automation v1.3.1.": "Review the next revision, then create it when you’re ready.",
        "Revision history remains readable, but workspace issues must be resolved before recording approval.": "You can still read the revision history, but fix the studio setup issues before approving a revision.",
        "Select a revision, review the lifecycle impact, and confirm its approval through JL Mixing Automation v1.3.1.": "Choose a revision, review what will change, then approve it.",
        "Delivery history remains readable, but workspace issues must be resolved before creating a package.": "You can still read the delivery history, but fix the studio setup issues before creating a package.",
        "Preview and confirm the first package using Automation defaults with mandatory SHA-256 verification and optional ZIP output.": "Preview the first delivery package, then create it with file verification and an optional ZIP.",
        "${resolvedProject.artist} · Automation-managed intake validation.": "${resolvedProject.artist} · Check the files before mixing.",
        "${resolvedProject.artist} · Authoritative revision history.": "${resolvedProject.artist} · Revisions, approvals, and mix history.",
        "${resolvedProject.artist} · Authoritative delivery state.": "${resolvedProject.artist} · Final files and delivery status.",
        "${resolvedProject.artist} · Authoritative project state.": "${resolvedProject.artist} · Project details and next steps.",
        "Validated client defaults and projects from the current workspace.": "Client details, defaults, and projects in your studio.",
    },
}

for path, mapping in replacements.items():
    text = path.read_text()
    for old, new in mapping.items():
        if old not in text:
            raise SystemExit(f"Expected copy not found in {path}: {old}")
        text = text.replace(old, new)
    path.write_text(text)

# The codemod is intentionally one-time; keep only the source changes in the PR.
Path("scripts/refine-ui-copy.py").unlink()
Path(".github/workflows/refine-ui-copy.yml").unlink()
