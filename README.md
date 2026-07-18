# JL Mixing Studio

JL Mixing Studio is an open-source desktop application for small-studio and home-studio mix engineers. It provides a visual, studio-aware workflow over the project structure and automation capabilities established by [JL Mixing Automation](https://github.com/JLAudio/jl-mixing).

> [!IMPORTANT]
> JL Mixing Studio is in early development. It is not yet ready for production use.

## Product direction

JL Mixing Studio will help engineers:

- Create and manage clients and mix projects.
- Understand project state, revisions, approvals, and delivery status at a glance.
- Run supported JL Mixing Automation workflows through a guided interface.
- Review intake-validation results and actionable warnings.
- Configure studio-specific defaults without hiding the underlying project data.
- Keep projects portable and understandable outside the application.

JL Mixing Automation v1.2.0 is the current functional baseline. The GUI must preserve its project semantics unless a change is explicitly designed and approved.

## Architecture

The accepted architecture is:

- **Desktop framework:** Tauri 2
- **Frontend:** React and TypeScript
- **Desktop integration:** Rust
- **License:** Apache-2.0
- **Initial platforms:** macOS and Windows

The architecture spike passed its automated macOS and Windows gates and manual Intel macOS Monterey validation. See [ADR-0001](docs/adr/0001-tauri-2.md).

## Project documents

- [Developer setup and validation](docs/DEVELOPMENT.md)
- [Product Requirements Document](docs/PRD.md)
- [Architecture decision: Tauri 2](docs/adr/0001-tauri-2.md)
- [Definition of Done](docs/DEFINITION_OF_DONE.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Development status

The architecture spike, application shell, and read-only client/project browsing are complete. The application:

1. Discovers the fixed default workspace at `~/Music/Mixes`.
2. Validates released studio, client, and project metadata schemas.
3. Provides Clients, Client Details, Projects, and Project Overview routes backed by validated workspace data.
4. Keeps valid projects visible when another workspace item is malformed.
5. Reports actionable setup and recovery guidance without modifying project data.

Guided client and project creation are the approved controlled write workflows. Each performs a non-mutating dry-run, requires explicit confirmation, invokes only its fixed JL Mixing Automation v1.2.0 command without a shell, and verifies the result through refreshed discovery. Project lifecycle workflows remain out of scope.

## Contributing

Development uses feature branches and pull requests. Do not commit directly to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
