# Development setup

JL Mixing Studio currently contains an architecture-validation spike built with Tauri 2, React, TypeScript, and Rust.

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

For the architecture validation, the last command must report `jl-mixing 1.2.0`.

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

For the open architecture-spike pull request, check out its feature branch:

```shell
git switch agent/tauri-architecture-spike
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

1. Run all commands under **Verify prerequisites**.
2. Confirm `jl-mixing --version` reports `jl-mixing 1.2.0`.
3. Run `npm ci`.
4. Run all commands under **Automated checks**.
5. Run `npm run tauri dev`.
6. Confirm the Environment card reports `macos` and `x86_64`.
7. Confirm JL Mixing Automation reports version `1.2.0` as detected.
8. Confirm the fixture shows schema `1.1.0` and `created_with` value `jl-mixing 1.2.0`.
9. Resize the window to its minimum size and confirm all content remains readable.

Record the results on the architecture-spike pull request. The Tauri decision remains provisional until this manual check and Windows CI succeed.

## Known limitations

- Only a bundled, sanitized manifest fixture can be read.
- Only the fixed `jl-mixing --version` operation can be executed.
- The spike does not create or modify projects.
- Browser rendering does not validate native Tauri integration.
