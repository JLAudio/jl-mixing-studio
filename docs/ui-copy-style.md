# JL Mixing Studio UI Copy Style

## Voice

Use a blend of **Creative collaborator** and **Studio casual**.

The application should feel like a capable assistant in the room with the engineer: warm, clear, relaxed, and lightly conversational without becoming jokey, slang-heavy, or unprofessional.

## Principles

- Lead with studio language: studio, client, project, mix, revision, delivery, files, notes, reports.
- Tell the user what happened and what to do next.
- Prefer task and consequence over implementation detail.
- Keep headings, buttons, prompts, and helper text short and natural.
- Avoid unnecessary terms such as `authoritative`, `derived`, `provider`, `API`, `schema`, `validated workspace`, or `manifest` in normal workflows.
- Keep technical identifiers, paths, schema versions, checksums, and similar detail where they are useful in Metadata, diagnostics, or troubleshooting.
- Keep destructive confirmations, uncertain results, and error recovery precise and serious. Friendly tone must never weaken safety language.
- Avoid forced music puns, hype, or slang.

## Example voice

- “Here’s what’s happening in the studio.”
- “What needs your attention”
- “Ready for another revision?”
- “Your mix is approved.”
- “Delivery is ready to go.”
- “Something doesn’t look right. Check the details below.”

## Implementation

Copy changes should remain separate from workflow or API behavior changes. When wording changes, update corresponding UI tests so they continue to verify the user-visible contract.

The v1.1 copy audit includes normal screens, dialogs, helper and disabled states, success notices, surfaced fallback errors, and uncertain-result guidance. Technical terminology should remain only where it helps with Metadata, diagnostics, troubleshooting, or decision-critical safety details.
