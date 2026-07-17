# Development setup

JL Mixing Studio is an early-stage desktop application built with Tauri 2, React, TypeScript, and Rust. The current product slice discovers an existing JL Mixing Automation workspace without modifying it.

## What you need

- Git.
- Node.js 22 LTS or 24 LTS and its bundled npm.
  - Node.js 22 LTS is the recommended choice for the Intel macOS Monterey validation machine.
  - CI currently exercises Node.js 24.
- A current stable Rust toolchain with Cargo, Clippy, and rustfmt.
- Tauri's operating-system build prerequisites.
- JL Mixing Automation v1.2.0 on `PATH` to exercise successful CLI detection.

You do not need GitHub CLI (`gh`), Homebrew, a global Tauri CLI installation, or—on macOS—the full Xcode application. The repository installs the Tauri CLI locally with `npm ci`.

## macOS prerequisites

Install Apple's Command Line Tools. They provide Git, Clang, and the native linker:

```shell
xcode-select --install
```

Install a compatible Node.js LTS release from [nodejs.org](https://nodejs.org/en/download). The Node.js installer includes npm.

For a new Rust installation, install the stable toolchain with [rustup](https://rustup.rs):

```shell
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

An existing package-managed stable Rust installation, including Homebrew Rust, is also acceptable when `rustc`, Cargo, Clippy, and rustfmt all work. Do not install a second Rust toolchain solely for this project.

## Windows prerequisites

Follow the official [Tauri prerequisites for Windows](https://v2.tauri.app/start/prerequisites/#windows). Install a compatible Node.js LTS release, stable Rust with the Microsoft MSVC toolchain, Microsoft C++ Build Tools, and WebView2 where the operating system does not already provide it.

## Verify prerequisites

```shell
git --version
node --version
npm --version
rustc --version
cargo --version
cargo clippy --version
rustfmt --version
jl-mixing --version
```

For the current functional baseline, the last command should report `jl-mixing 1.2.0`. On Windows, where JL Mixing Automation v1.2.0 is not supported, the application reports the CLI as unavailable without preventing the read-only dashboard from loading.

On macOS, also confirm the Apple developer tools path:

```shell
xcode-select -p
```

## Get the source

```shell
mkdir -p ~/Development/jlaudio
cd ~/Development/jlaudio
git clone https://github.com/JLAudio/jl-mixing-studio.git
cd jl-mixing-studio
```

## Install project dependencies

From the repository root:

```shell
npm ci
```

A global Tauri installation is not required.

## Run the frontend in a browser

```shell
npm run dev
```

The browser view cannot call Tauri commands. Use it only for layout work with suitable mocks or component tests.

## Run the desktop application

```shell
npm run tauri dev
```

The application exposes three typed Rust commands:

- `get_system_info`
- `get_jl_mixing_version`
- `discover_default_workspace`

The dashboard uses the version and discovery commands independently. The frontend cannot select an executable, supply process arguments, or provide a workspace or manifest path. Rust resolves the fixed default workspace at `~/Music/Mixes`.

Workspace discovery validates `studio.json`, `client.json`, and project manifests against copies of the released JL Mixing Automation v1.2.0 schemas in `schemas/jl-mixing-v1.2.0/`. Those document schemas remain version `1.1.0`.

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

Release installers, signing, notarization, and automatic updates remain outside the current milestone.

## Intel macOS Monterey workspace validation

On the Intel MacBook running macOS Monterey 12.7.6:

1. Run all commands under **Verify prerequisites**.
2. Confirm `jl-mixing --version` reports `jl-mixing 1.2.0`.
3. Run `npm ci`.
4. Run all commands under **Automated checks**.
5. Run `npm run tauri dev`.
6. Confirm JL Mixing Automation reports version `1.2.0` as detected.
7. Confirm the dashboard identifies the studio at `~/Music/Mixes`.
8. Confirm client and project counts match the workspace.
9. Confirm each valid project shows its current, approved, and delivered revision.
10. Use **Refresh** and confirm the dashboard reloads without restarting.
11. Confirm opening and refreshing the dashboard does not change workspace files.
12. Resize the window to its minimum size and confirm all content remains readable.

Record the results on the workspace-discovery pull request.

## Known limitations

- Only the fixed `jl-mixing --version` operation can be executed.
- Only the fixed default workspace can be discovered; arbitrary workspace selection is not implemented.
- Discovery is read-only and cannot create or modify projects.
- JL Mixing Automation v1.2.0 does not run natively on Windows.
- Browser rendering does not validate native Tauri integration.
