# JL Mixing Studio

JL Mixing Studio is an open-source desktop application for small-studio and home-studio mix engineers. It provides a visual, studio-aware workflow over the project structure and automation capabilities established by [JL Mixing Automation](https://github.com/JLAudio/jl-mixing).

> [!IMPORTANT]
> JL Mixing Studio is in the planning and architecture-validation stage. It is not yet ready for production use.

## Product direction

JL Mixing Studio will help engineers:

- Create and manage clients and mix projects.
- Understand project state, revisions, approvals, and delivery status at a glance.
- Run supported JL Mixing Automation workflows through a guided interface.
- Review intake-validation results and actionable warnings.
- Configure studio-specific defaults without hiding the underlying project data.
- Keep projects portable and understandable outside the application.

JL Mixing Automation v1.2.0 is the current functional baseline. The GUI must preserve its project semantics unless a change is explicitly designed and approved.

## Provisional architecture

The current architecture direction is:

- **Desktop framework:** Tauri 2
- **Frontend:** React and TypeScript
- **Desktop integration:** Rust
- **License:** Apache-2.0
- **Initial platforms:** macOS and Windows

This direction remains provisional until the architecture spike in [ADR-0001](docs/adr/0001-tauri-2.md) passes.

## Project documents

- [Product Requirements Document](docs/PRD.md)
- [Architecture decision: Tauri 2](docs/adr/0001-tauri-2.md)
- [Definition of Done](docs/DEFINITION_OF_DONE.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Development status

The next milestone is a minimal architecture spike proving that the application can:

1. Launch on an Intel Mac running macOS Monterey.
2. Build and launch on Windows.
3. Invoke `jl-mixing --version` through a restricted Rust command.
4. Read and display a representative JL Mixing Automation v1.2.0 project manifest through a typed Rust boundary.

No product feature implementation should begin until the spike is reviewed.

## Contributing

Development uses feature branches and pull requests. Do not commit directly to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
