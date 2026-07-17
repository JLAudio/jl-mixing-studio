# Development setup

JL Mixing Studio currently contains an architecture-validation spike built with Tauri 2, React, TypeScript, and Rust.

## Prerequisites

- Node.js 24 or a compatible current LTS release.
- npm 11 or a compatible release.
- The current stable Rust toolchain installed with rustup.
- Tauri's operating-system prerequisites.
- JL Mixing Automation v1.2.0 on `PATH` to exercise successful CLI detection.

Follow the official Tauri prerequisite instructions for macOS or Windows before building the desktop application.

## Install

```shell
npm ci
```

## Run the frontend in a browser

```shell
npm run dev
```

The browser view cannot call Tauri commands. Use it only for layout work with suitable mocks or component tests.

## Run the desktop application

```shell
npm run tauri dev
```

The validation screen invokes three typed Rust commands:

- `get_system_info`
- `get_jl_mixing_version`
- `read_sample_manifest`

The frontend cannot select an executable, supply process arguments, or provide a manifest path.

## Automated checks

```shell
npm run check
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-features
```

## Build without creating installers

```shell
npm run tauri build -- --no-bundle
```

Release installers, signing, notarization, and automatic updates are outside the spike.

## Intel macOS Monterey validation

On the Intel MacBook running macOS Monterey 12.7.6:

1. Confirm `node --version`, `npm --version`, `rustc --version`, and `cargo --version` succeed.
2. Confirm `jl-mixing --version` reports `jl-mixing 1.2.0`.
3. Run `npm ci`.
4. Run `npm run check`.
5. Run the Rust formatting, Clippy, and test commands above.
6. Run `npm run tauri dev`.
7. Confirm the Environment card reports `macos` and `x86_64`.
8. Confirm JL Mixing Automation reports version `1.2.0` as detected.
9. Confirm the fixture shows schema `1.1.0` and `created_with` value `jl-mixing 1.2.0`.
10. Resize the window to its minimum size and confirm all content remains readable.

Record the results on the architecture-spike pull request. The Tauri decision remains provisional until this manual check and Windows CI succeed.

## Known limitations

- Only a bundled, sanitized manifest fixture can be read.
- Only the fixed `jl-mixing --version` operation can be executed.
- The spike does not create or modify projects.
- Browser rendering does not validate native Tauri integration.
