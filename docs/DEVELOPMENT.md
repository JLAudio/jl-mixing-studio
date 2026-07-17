# Development setup

JL Mixing Studio is an early-stage desktop application built with Tauri 2, React, TypeScript, and Rust. The current product slice discovers an existing JL Mixing Automation workspace without modifying it.

## What you need

- Git.
- Node.js 22 LTS or 24 LTS and its bundled npm.
  - Node.js 22 LTS is the recommended choice for the Intel macOS Monterey validation machine.
  - CI currently exercises Node.js 24.
- A current stable Rust toolchain with Cargo, Clippy, and rustfmt.
- Tauri's operating-system build prerequisites.
- JL Mixing Automation v1.2.0 installed to its default `~/.local/bin` command location or available on `PATH` to exercise automation workflows.

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
cat "$HOME/.local/share/jl-mixing/VERSION"
new-client --help
```

For the current functional baseline, the installed `VERSION` file must report `1.2.0` and `new-client --help` must succeed. JL Mixing Automation v1.2.0 installs individual workflow commands; it does not provide a top-level `jl-mixing` command. On Windows, where JL Mixing Automation v1.2.0 is not supported, the application reports the CLI as unavailable without preventing the read-only dashboard from loading.

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

The application exposes five typed Rust commands:

- `get_system_info`
- `get_jl_mixing_version`
- `discover_default_workspace`
- `preflight_client_creation`
- `create_client`

The dashboard uses the version and discovery commands independently. Rust resolves the fixed `new-client` launcher from the release installer's default `~/.local/bin` command location before falling back to the inherited process `PATH`. It derives that launcher's installation prefix, reads the fixed `share/jl-mixing/VERSION` file, and runs `new-client --help` as a health check. The frontend cannot select an executable, executable path, version path, working directory, process arguments, workspace, or manifest path. Rust resolves the fixed default workspace at `~/Music/Mixes`.

Client creation is available only with JL Mixing Automation v1.2.0 and a healthy or empty workspace. Preflight invokes the allowlisted `new-client` command with `--dry-run` and no directory-change flag. Confirmed creation repeats validation and invokes the same fixed command with `--no-cd`. User values are passed as separate process arguments; no shell command string is constructed.

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

## Intel macOS Monterey client-creation validation

Client creation is a real workspace mutation. Use a disposable macOS test account with its own `~/Music/Mixes` workspace. Do not use a production studio workspace merely for validation; this milestone intentionally has no client-deletion workflow.

On the Intel MacBook running macOS Monterey 12.7.6, while signed into the disposable account:

1. Run all commands under **Verify prerequisites**.
2. Confirm `~/.local/share/jl-mixing/VERSION` reports `1.2.0` and `new-client --help` succeeds.
3. Create an isolated default test workspace with `new-studio` if the account does not have one.
4. Run `npm ci` and all commands under **Automated checks**.
5. Record a recursive file inventory and checksums for `~/Music/Mixes`.
6. Run `npm run tauri dev`.
7. Confirm JL Mixing Automation reports version `1.2.0` as detected and **New client** is enabled.
8. Open **New client**, enter a unique test ID and display name, and select **Review client**.
9. Confirm the preview is displayed and the file inventory is unchanged.
10. Select **Cancel** and confirm the file inventory is still unchanged.
11. Repeat the preflight, confirm creation, and verify the new client appears without a manual refresh.
12. Confirm the only new workspace entries are the expected client directory, `client.json`, and empty `Projects/` directory.
13. Attempt the same client ID again and confirm a collision is reported without unrelated changes.
14. Confirm keyboard focus moves into the form and confirmation step, Escape cancels when no operation is running, and repeated clicks cannot submit twice.
15. Resize the window to its minimum size and confirm the dashboard and client dialog remain readable.

Record the results on the guided-client-creation pull request. Keep or manually archive the disposable test account after validation; JL Mixing Studio must not add unapproved deletion behavior for test cleanup.

## Known limitations

- Automation detection reads only the fixed `VERSION` metadata associated with the resolved `new-client` launcher and executes only its fixed `--help` health check.
- Only the fixed default workspace can be discovered; arbitrary workspace selection is not implemented.
- Discovery is read-only and cannot create or modify projects.
- Client creation exposes only client ID, display name, and optional default artist; other values inherit studio defaults.
- Client editing and deletion are not implemented.
- JL Mixing Automation v1.2.0 does not run natively on Windows.
- Browser rendering does not validate native Tauri integration.
