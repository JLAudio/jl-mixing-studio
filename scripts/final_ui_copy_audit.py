from pathlib import Path

replacements = {
    "Studio preflight could not be completed.": "The studio setup could not be reviewed.",
    "Client preflight could not be completed.": "The client details could not be reviewed.",
    "Project preflight could not be completed.": "The project details could not be reviewed.",
    "The delivery preview did not match the authoritative project state.": "The delivery preview no longer matches the current project. Refresh the project and review the delivery again.",
    "The revision preview did not match the authoritative project state.": "The revision preview no longer matches the current project. Refresh Revisions and review it again.",
    "The approval preview did not match the authoritative revision state.": "The approval preview no longer matches the current revision history. Refresh Revisions and review the approval again.",
    "JL Mixing Automation reported success, but the new client was not found after refresh. The operation may have completed.": "The client creation completed, but the new client was not found after refresh. The result is uncertain.",
    "JL Mixing Automation reported success, but the workspace could not be refreshed. The operation may have completed.": "The client was created, but the studio could not be refreshed. The result is uncertain.",
    "JL Mixing Automation reported success, but the created project identity did not match the preflight. The operation may have completed.": "The project was created, but its details did not match what you reviewed. The result is uncertain.",
    "JL Mixing Automation reported success, but the new project was not found after refresh. The operation may have completed.": "The project was created, but it was not found after refresh. The result is uncertain.",
    "JL Mixing Automation reported success, but the workspace could not be refreshed. The operation may have completed.${detail ? ` ${detail}` : \"\"}": "The project was created, but the studio could not be refreshed. The result is uncertain.${detail ? ` ${detail}` : \"\"}",
    "JL Mixing Automation reported success, but the created delivery did not match the confirmed preview. The operation may have completed; do not retry automatically.": "The delivery was created, but it did not match what you confirmed. The result is uncertain; do not retry automatically.",
    "The delivery command succeeded, but the refreshed authoritative package did not match the preview. The operation may have completed; do not retry automatically.": "The delivery was created, but the refreshed delivery details did not match what you confirmed. The result is uncertain; do not retry automatically.",
    "The delivery command succeeded, but the workspace could not be refreshed. The operation may have completed; do not retry automatically.": "The delivery was created, but the studio could not be refreshed. The result is uncertain; do not retry automatically.",
    "JL Mixing Automation reported success, but the created revision did not match the preview. The operation may have completed; do not retry automatically.": "The revision was created, but it did not match what you reviewed. The result is uncertain; do not retry automatically.",
    "The revision command succeeded, but the refreshed authoritative history did not match the preview. The operation may have completed; do not retry automatically.": "The revision was created, but the refreshed revision history did not match what you reviewed. The result is uncertain; do not retry automatically.",
    "The revision command succeeded, but the workspace could not be refreshed. The operation may have completed; do not retry automatically.": "The revision was created, but the studio could not be refreshed. The result is uncertain; do not retry automatically.",
    "JL Mixing Automation reported success, but the approval did not match the preview. The operation may have completed; do not retry automatically.": "The approval was recorded, but it did not match what you reviewed. The result is uncertain; do not retry automatically.",
    "The approval command succeeded, but the refreshed authoritative state did not match its result. The operation may have completed; do not retry automatically.": "The approval was recorded, but the refreshed project approval did not match the result. The result is uncertain; do not retry automatically.",
    "The approval command succeeded, but the workspace could not be refreshed. The operation may have completed; do not retry automatically.": "The approval was recorded, but the studio could not be refreshed. The result is uncertain; do not retry automatically.",
    "was created and added to the workspace.": "was added to your studio.",
}

for filename in ["src/App.tsx", "src/App.test.tsx"]:
    path = Path(filename)
    text = path.read_text()
    for old, new in replacements.items():
        text = text.replace(old, new)
    path.write_text(text)
