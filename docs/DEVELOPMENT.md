# Development setup

JL Mixing Studio is an early-stage desktop application built with Tauri 2, React, TypeScript, and Rust. It discovers the fixed JL Mixing Automation workspace and exposes only focused, reviewed workflow mutations.

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
new-mix --help
validate-intake --help
new-revision --help
approve-mix --help
```

For the current functional baseline, the installed `VERSION` file must report `1.2.0`, and `new-client --help`, `new-mix --help`, `validate-intake --help`, `new-revision --help`, and `approve-mix --help` must succeed. JL Mixing Automation v1.2.0 installs individual workflow commands; it does not provide a top-level `jl-mixing` command. On Windows, where JL Mixing Automation v1.2.0 is not supported, the application reports guided automation as unavailable without preventing supported report reading and workspace browsing.

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

The application exposes sixteen typed Rust commands:

- `get_system_info`
- `get_jl_mixing_version`
- `discover_default_workspace`
- `preflight_client_creation`
- `create_client`
- `preflight_project_creation`
- `create_project`
- `get_intake_report`
- `preflight_intake_validation`
- `run_intake_validation`
- `preflight_revision_creation`
- `create_revision`
- `preflight_revision_approval`
- `approve_revision`
- `preflight_delivery_creation`
- `create_delivery`

The dashboard uses the version and discovery commands independently. Rust resolves the fixed `new-client` launcher from the release installer's default `~/.local/bin` command location before falling back to the inherited process `PATH`. It derives that launcher's installation prefix, reads the fixed `share/jl-mixing/VERSION` file, and runs `new-client --help` as a health check. The frontend cannot select an executable, executable path, version path, working directory, process arguments, workspace, or manifest path. Rust resolves the fixed default workspace at `~/Music/Mixes`.

Client creation is available only with JL Mixing Automation v1.2.0 and a healthy or empty workspace. Preflight invokes the allowlisted `new-client` command with `--dry-run` and no directory-change flag. Confirmed creation repeats validation and invokes the same fixed command with `--no-cd`. User values are passed as separate process arguments; no shell command string is constructed.

Project creation follows the same fixed-command boundary with `new-mix --dry-run` and confirmed `new-mix --no-cd` from an internally resolved validated client directory.

Intake reads `00_Admin/Intake_Report.md` only after Rust resolves an exact validated client/project identity. Preview invokes only `validate-intake --dry-run` from that project directory. Confirmation invokes `validate-intake` with no arguments, then re-reads and parses the authoritative managed report section. Exit code 5 is a completed validation with blocking findings. The initial Studio workflow does not expose source, expected-format, or duplicate-check overrides, and it never modifies intake source files.

Workspace discovery validates `studio.json`, `client.json`, and project manifests against copies of the released JL Mixing Automation v1.2.0 schemas in `schemas/jl-mixing-v1.2.0/`. Those document schemas remain version `1.1.0`. A document's `created_with` version records provenance rather than imposing a v1.2.0 minimum, so valid schema-v1.1.0 documents created by historical Automation releases such as v1.1.1 remain readable.

When a project records a delivered revision, discovery also validates `05_Final_Delivery/delivery-manifest.json` against the released delivery schema and correlates its client, project, revision, and safe unique file paths with the project manifest. Delivery approval metadata remains the immutable package-time snapshot and may differ after a later reapproval of the same revision. Studio displays the manifest's recorded SHA-256 values but does not re-hash package files during discovery. A missing or inconsistent delivery manifest invalidates only that project and preserves valid siblings.

Revision history is part of workspace discovery rather than a separate read command or cache. Rust preserves each manifest revision's stable ID, timestamp, description, and paired approval metadata, sorts records deterministically for the frontend, and rejects duplicate or gapped revision numbers, duplicate revision IDs, inconsistent current-revision counts, and approved or delivered pointers that do not identify an approved revision. The history remains readable for valid projects retained in a partial workspace.

Revision creation resolves an exact validated client/project identity and invokes only `new-revision [--description TEXT] --dry-run` for preview or `new-revision [--description TEXT] --no-cd` after confirmation. The frontend cannot provide a source path. After success, Rust re-discovers the project and requires one new contiguous revision, unchanged prior revision records, unchanged approved and delivered pointers, and a new unique revision ID before reporting a confirmed result.

Revision approval resolves the same exact project identity and invokes only `approve-mix --revision NUMBER --approved-by NAME --dry-run` for preview or `approve-mix --revision NUMBER --approved-by NAME` after confirmation. Studio does not expose `--project`, `--date`, notes, or delivery arguments. Automation supplies the execution timestamp. After success, Rust requires the selected revision to contain the returned approval identity and timestamp, the approved pointer to identify it, and all unrelated project and revision state—including the delivered pointer—to remain unchanged.

First-delivery creation resolves the same exact project identity and is available only when an approved revision exists without a delivered pointer or delivery manifest. Preview invokes only `create-delivery --dry-run` from the validated project directory; confirmation invokes `create-delivery` with no arguments. Studio exposes no project path, include/exclude patterns, working-prefix override, ZIP, overwrite, or clean replacement. After success, Rust re-discovers the workspace and requires the delivered pointer, validated manifest revision, file paths, and classifications to match the Automation plan while all pre-existing project metadata, pointers, and revision history remain unchanged.

Workspace discovery also derives ranked Tasks and Activity from validated recovery findings, deadlines, revision pointers, and supported persisted timestamps. Dashboard and full routes consume the same read-only collections; refresh writes no database, cache, task state, event log, or workspace file.

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

## Intel macOS Monterey guided-creation validation

Client and project creation are real workspace mutations. Use a disposable macOS test account with its own `~/Music/Mixes` workspace. Do not use a production studio workspace merely for validation; this milestone intentionally has no deletion workflow.

On the Intel MacBook running macOS Monterey 12.7.6, while signed into the disposable account:

1. Run all commands under **Verify prerequisites**.
2. Confirm `~/.local/share/jl-mixing/VERSION` reports `1.2.0`, and both `new-client --help` and `new-mix --help` succeed.
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
16. Open the created client's details, select **New project**, enter a unique project name, and select **Review project**.
17. Confirm the Automation-derived project ID, inherited artist, and initial Revision 1 are shown while the workspace inventory remains unchanged.
18. Cancel once and confirm no project was created; repeat the preflight and confirm creation.
19. Verify the new project opens in Project Overview with Revision 1 and that its standard JL Mixing Automation structure is present under the selected client.
20. Repeat the same project name and confirm a collision is reported without unrelated changes.
21. Start another confirmed creation and simulate or observe a refresh failure only in an isolated test environment; verify Studio warns that the result is uncertain and does not retry automatically.
22. Copy disposable audio and documentation into the created project's default `01_Client_Files/Original_Delivery/` directory.
23. Open **Intake**, confirm the current report is shown as not yet validated, and select **Preview validation**.
24. Verify the preview counts and findings reflect the disposable source while the project inventory and `Intake_Report.md` checksum remain unchanged.
25. Cancel once, then preview again and confirm **Update intake report**.
26. Verify only the managed section of `00_Admin/Intake_Report.md` changed and the source-file checksums did not change.
27. Include an unreadable candidate audio file in a disposable copy and verify blocking findings are presented as a completed result rather than a command failure.
28. Simulate an unverifiable confirmed result only in the disposable environment and verify Studio warns not to retry automatically.
29. Open the project's Revisions route, select **New revision**, enter an optional disposable description, and review the dry-run preview.
30. Cancel once and verify that the manifest and revision directory inventory are unchanged.
31. Repeat the preview, confirm creation, and verify exactly one new revision directory and one new manifest record were added.
32. Verify the new revision becomes current while the prior revision records and approved and delivered pointers remain unchanged.
33. Simulate an unverifiable revision result only in the disposable environment and verify Studio warns not to retry automatically.
34. Select an unapproved revision, choose **Approve revision**, keep or edit the approver identity, and review the dry-run preview.
35. Cancel once and verify the manifest checksum is unchanged.
36. Repeat the preview, confirm approval, and verify only the selected revision approval metadata, the approved pointer, and manifest modification timestamp changed.
37. Select an older historically approved revision and verify the confirmation warns that prior approval metadata will be replaced and that the revision is older than current.
38. If a delivery exists for another revision, verify the confirmation states that delivery remains unchanged.
39. Simulate an unverifiable approval result only in the disposable environment and verify Studio warns not to retry automatically.
40. Open Delivery for a project with an approved but undelivered revision and select **Create delivery**.
41. Confirm the preview lists Automation's selected paths, classifications, exclusions, fixed default replacement mode, and no ZIP while the workspace inventory remains unchanged.
42. Cancel once and verify the project manifest and delivery directory inventory are unchanged.
43. Repeat the preview, confirm creation, and verify the delivered pointer, delivery manifest, copied files, and SHA-256 records appear after refresh.
44. Verify existing packages disable creation and explain that replacement requires a separate reviewed workflow.
45. Simulate an unverifiable confirmed delivery only in the disposable environment and verify Studio warns not to retry automatically.

Record the results on the guided-first-delivery pull request. Keep or manually archive the disposable test account after validation; JL Mixing Studio must not add unapproved deletion behavior for test cleanup.

## Known limitations

- Automation detection reads only the fixed `VERSION` metadata associated with the resolved `new-client` launcher and executes only its fixed `--help` health check.
- Only the fixed default workspace can be discovered; arbitrary workspace selection is not implemented.
- Folder controls accept only an allowlisted location kind plus validated client/project identities. Rust canonicalizes existing directories beneath the fixed workspace root before returning a path or invoking `open`, `explorer.exe`, or `xdg-open`; the frontend cannot supply a path or executable.
- Discovery remains read-only. Guided studio setup is permitted only when the fixed default workspace is absent; it invokes `new-studio` with allowlisted identity/audio arguments plus `--dry-run` for preview or `--no-default-cd` for confirmation, then reconciles the validated `studio.json`. Existing, partial, and invalid workspaces block setup, and uncertain results are never retried automatically.
- Client creation exposes only client ID, display name, and optional default artist; other values inherit studio defaults.
- Project creation exposes only a validated client, project display name, and optional artist; Automation derives all other values and creates Revision 1.
- Intake validation uses only Automation defaults; custom source, expected-format, and duplicate-check options are not exposed.
- Revision creation accepts only an optional description; Automation's `--source` option is not exposed.
- Revision approval accepts only a selected validated revision and approver identity; approval timestamp override is not exposed.
- First-delivery creation uses only Automation defaults and is unavailable once a package exists.
- Tasks and Activity are derived read-only views; there is no manual task completion or complete audit log.
- ZIP generation, filters, overwrite, and destructive clean replacement remain Planned.
- Client editing and deletion are not implemented.
- JL Mixing Automation v1.2.0 does not run natively on Windows.
- Browser rendering does not validate native Tauri integration.
