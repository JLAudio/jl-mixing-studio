from pathlib import Path

app = Path("src/App.tsx")
text = app.read_text()

replacements = {
    "Choose the supported package output for <strong>{projectName}</strong>. Studio will preview the exact Automation plan before making changes.": "Choose how to package <strong>{projectName}</strong>. You’ll review the exact files and changes before anything happens.",
    "Preserves Delivery Notes and unrelated files; rejects a changed delivered path set.": "Replaces only the same delivered file paths and keeps Delivery Notes and unrelated files. If the delivered path set changed, the rebuild stops.",
    "Deletes every existing item in 05_Final_Delivery before rebuilding it.": "Deletes everything currently inside 05_Final_Delivery before creating the new delivery.",
    'Created from the Automation template': 'Created from the standard delivery template',
    "Automation will replace only the same manifest-recorded delivery paths and preserve Delivery Notes and unrelated package files. A changed path set is rejected.": "Only the same delivered file paths will be replaced. Delivery Notes and unrelated files stay in place. If the delivered paths changed, nothing is replaced.",
    "Every file, folder, edited note, ZIP, and unrelated item currently inside 05_Final_Delivery will be deleted. The next screen lists the exact deletion preview.": "Everything currently inside 05_Final_Delivery—including files, folders, edited Delivery Notes, ZIPs, and unrelated items—will be deleted before the new delivery is created. The next screen lists every item.",
    "Do not submit the request again automatically. Close this message and refresh the authoritative delivery state.": "Do not run delivery again automatically. Close this message, refresh Delivery, and verify the result before trying again.",
    "Automation will verify every copied file with SHA-256 and update the delivered pointer transactionally.": "Each copied file will be verified with SHA-256 before the project’s delivery status is updated.",
    "Excluded by Automation defaults": "Not included in this delivery",
    "Every existing item Automation will delete": "These items will be deleted",
    "Workspace change": "What will change",
    'This {state.preview.replacementMode === "clean" ? "deletes every previewed item and rebuilds" : state.preview.replacementMode === "overwrite" ? "rebuilds" : "creates"} files in 05_Final_Delivery and sets state.delivered_revision to Revision {state.preview.approvedRevision}.{state.preview.replacementMode === "overwrite" ? " Edited Delivery Notes and unrelated files are preserved." : state.preview.replacementMode === "clean" ? " Delivery Notes are recreated from the Automation template." : ""} Custom filters are not enabled.': 'This {state.preview.replacementMode === "clean" ? "deletes every item listed above, then rebuilds" : state.preview.replacementMode === "overwrite" ? "rebuilds" : "creates"} the files in 05_Final_Delivery and marks Revision {state.preview.approvedRevision} as delivered.{state.preview.replacementMode === "overwrite" ? " Edited Delivery Notes and unrelated files are preserved." : state.preview.replacementMode === "clean" ? " Delivery Notes are recreated from the standard template." : ""} Custom filters are not enabled.',
    "Automation will derive the number, ID, timestamp, folder, and notes template.": "JL Mixing Studio will create the next revision number, folder, ID, timestamp, and notes file.",
    "Leave blank to use the Automation default. Source files are added manually in this milestone.": "Leave blank to use the default description. Source files are still added manually.",
    "Preflight passed without changing the project. Confirm to create exactly one new revision. Existing approved and delivered pointers will be preserved.": "Nothing has changed yet. Confirm to create one new revision. The currently approved and delivered revisions will stay unchanged.",
    "Do not submit the request again automatically. Close this message and refresh the authoritative revision history.": "Do not create another revision automatically. Close this message, refresh Revisions, and verify the result before trying again.",
    "Automation will use the current time when approval is confirmed.": "The current time will be recorded when you confirm the approval.",
    "This identity is written to the authoritative project manifest.": "This name is saved with the project approval.",
    "Preflight passed without changing the project. Confirm to move the approved pointer and record new approval metadata for the selected revision.": "Nothing has changed yet. Confirm to make the selected revision the approved revision and save the new approval details.",
    "Review lifecycle impact": "Check what will change",
    "has historical approval metadata that will be replaced.": "has an existing approval record that will be replaced.",
    "Do not submit the approval again automatically. Close this message and refresh the authoritative revision history.": "Do not approve the revision again automatically. Close this message, refresh Revisions, and verify the result before trying again.",
    "Do not run validation again automatically. Close this message and refresh the authoritative report.": "Do not run intake validation again automatically. Close this message, refresh Intake, and verify the report before trying again.",
    "The dry-run preview below did not change the project. Confirm to replace only the Automation-managed section of <code>00_Admin/Intake_Report.md</code>. Intake source files will not be modified.": "The preview below did not change the project. Confirm to update only the generated section of <code>00_Admin/Intake_Report.md</code>. Your intake source files will not be changed.",
    "Use the guided JL Mixing Automation v1.3.1 workflow to create ~/Music/Mixes.": "Use guided setup to create your studio workspace at ~/Music/Mixes.",
    "Review the validated discovery issues below before changing the workspace.": "Check the setup issues below before making changes.",
    "Validated studio": "Your studio",
    "Creates the default workspace at <code>~/Music/Mixes</code>. No custom path or command options are accepted.": "Creates your studio workspace at <code>~/Music/Mixes</code>. This setup uses the standard location.",
    "Preflight passed without changing the filesystem. Confirm to create the default workspace.": "Nothing has been created yet. Confirm to create your studio workspace at the standard location.",
    "Do not submit again automatically. Close and refresh the authoritative workspace.": "Do not create the studio again automatically. Close this message, refresh Studio, and verify the workspace before trying again.",
    "Studio-owned preferences": "Studio preferences",
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
    "Preview and confirm the first package using Automation defaults with mandatory SHA-256 verification and optional ZIP output.": "Preview the first delivery package, then create it with SHA-256 file verification and an optional ZIP.",
    "${resolvedProject.artist} · Automation-managed intake validation.": "${resolvedProject.artist} · Check the files before mixing.",
    "${resolvedProject.artist} · Authoritative revision history.": "${resolvedProject.artist} · Revisions, approvals, and mix history.",
    "${resolvedProject.artist} · Authoritative delivery state.": "${resolvedProject.artist} · Final files and delivery status.",
    "${resolvedProject.artist} · Authoritative project state.": "${resolvedProject.artist} · Project details and next steps.",
    "Validated client defaults and projects from the current workspace.": "Client details, defaults, and projects in your studio.",
}

for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"Expected App copy not found: {old}")
    text = text.replace(old, new)
app.write_text(text)

# Update only tests that intentionally assert wording changed above.
test = Path("src/App.test.tsx")
t = test.read_text()
test_replacements = {
    "/history remains readable/i": "/still read the revision history/i",
    "/same-path overwrite that preserves edited Delivery Notes/i": "/same-path overwrite.*Delivery Notes/i",
}
for old, new in test_replacements.items():
    if old in t:
        t = t.replace(old, new)
test.write_text(t)
