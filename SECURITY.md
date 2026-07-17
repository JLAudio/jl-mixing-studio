# Security Policy

JL Mixing Studio is in early development and has no supported production release yet.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability involving arbitrary command execution, path traversal, destructive filesystem behavior, dependency compromise, or exposure of private project data.

Use GitHub's private vulnerability reporting feature when it is enabled for this repository. If private reporting is unavailable, contact the repository owner privately before disclosing details.

Include:

- A concise description of the issue.
- Affected version or commit.
- Reproduction steps.
- Expected impact.
- Any suggested mitigation.

## Security principles

JL Mixing Studio is designed to:

- Operate locally by default.
- Avoid telemetry by default.
- Restrict frontend capabilities.
- Validate filesystem paths and process arguments in Rust.
- Expose only allowlisted JL Mixing Automation operations.
- Require explicit handling for overwrite and destructive actions.
- Avoid treating untrusted project content as executable.

Security support and disclosure timelines will be formalized before the first public production release.
