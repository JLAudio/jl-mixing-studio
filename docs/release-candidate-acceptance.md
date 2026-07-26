# JL Mixing Studio 1.0 release-candidate acceptance results

Release candidate: `v1.0.0-rc.4`

Issue: [#51](https://github.com/JLAudio/jl-mixing-studio/issues/51)

This document records testing performed against the downloadable installers
published by the release workflow. A platform is not marked complete from a
development build or CI compilation alone.

## Final release-candidate decision

`v1.0.0-rc.4` is approved as the final release candidate for JL Mixing Studio
1.0.0.

- Intel macOS completed full packaged acceptance testing with all tests passing.
- Windows x64 completed the limited packaged acceptance scope available without
  JL Mixing Automation and passed all applicable checks.
- Apple Silicon macOS testing is deferred until suitable hardware is available.
  It is not represented as user-verified and does not block the 1.0.0 release.
- No unresolved release-blocking defect is known.

## Installer identity

| Platform | Expected asset | Tester | OS version | Result |
| --- | --- | --- | --- | --- |
| Intel Mac | `JL-Mixing-Studio_1.0.0-rc.4_macos_x86_64.dmg` | Project owner | Verified Intel macOS system | Pass |
| Apple Silicon Mac | `JL-Mixing-Studio_1.0.0-rc.4_macos_aarch64.dmg` |  |  | Deferred pending hardware |
| Windows x64 | `JL-Mixing-Studio_1.0.0-rc.4_windows_x86_64.exe` | Project owner | Verified Windows x64 system | Pass — limited scope |

Each tested installer was evaluated as a packaged release artifact rather than a
development build.

## Platform acceptance matrix

| Test | Intel Mac | Apple Silicon Mac | Windows x64 | Evidence / issue |
| --- | --- | --- | --- | --- |
| Clean install without Node, Rust, Cargo, or source checkout | Pass | Deferred | Pass | Packaged installers used |
| Launch from Applications / Start menu | Pass | Deferred | Pass | |
| Name, icon, version, architecture, and publisher metadata | Pass | Deferred | Pass | |
| Expected unsigned Gatekeeper / SmartScreen warning and documented bypass | Pass | Deferred | Pass | |
| Default workspace discovery | Pass | Deferred | Pass where applicable | |
| Paths containing spaces | Pass | Deferred | Pass where applicable | |
| Paths containing non-ASCII characters | Pass | Deferred | Pass where applicable | |
| JL Mixing Automation missing | Pass | Deferred | Pass | Windows correctly presents Automation as unavailable |
| JL Mixing Automation incompatible version rejected | Pass | Deferred | Not applicable | No Windows Automation distribution exists |
| JL Mixing Automation 1.3.1 detected and working | Pass | Deferred | Not applicable | Verified on Intel macOS |
| Intake report reading and validation | Pass | Deferred | Not applicable | Requires Automation on Windows |
| Revision creation and approval | Pass | Deferred | Not applicable | Requires Automation on Windows |
| Automation 1.3.1 delivery creation | Pass | Deferred | Not applicable | Requires Automation on Windows |
| Copy Path and Open Folder actions | Pass | Deferred | Pass where applicable | |
| Upgrade from previous release candidate preserves settings | Pass | Deferred | Pass | |
| Uninstall removes application binaries | Pass | Deferred | Pass | |
| Uninstall retains settings | Pass | Deferred | Pass | |
| Reinstall reuses retained settings | Pass | Deferred | Pass | |
| Manual settings removal resets the application | Pass | Deferred | Pass | |

## Windows acceptance scope

JL Mixing Automation 1.3.1 is not available on Windows. Windows acceptance was
therefore limited to the functionality that can be meaningfully exercised
without the Automation engine.

Verified on Windows x64:

- installer and uninstaller operation;
- application launch from the normal OS shortcut;
- application name, icon, version, and identity;
- main interface rendering;
- menus, dialogs, Settings, and About behavior;
- settings retention across uninstall and reinstall;
- clean reset after manual settings removal;
- graceful reporting that JL Mixing Automation is unavailable;
- no crash or misleading failure during standalone operation.

Not applicable to the Windows 1.0 acceptance scope:

- Automation integration;
- project creation and other write workflows backed by Automation;
- intake validation backed by Automation;
- revision approval and delivery creation;
- complete end-to-end mixing workflow validation.

These exclusions are expected product limitations and are not release defects.

## Apple Silicon deferral

The Apple Silicon package is produced by CI, but packaged acceptance testing is
deferred until Apple Silicon hardware is available. The release must not claim
that Apple Silicon has been manually verified. Any platform-specific defect
found later will be handled through the normal maintenance-release process.

## Retained settings cleanup

The application identifier is `com.jlaudio.jlmixingstudio`. The installer
removes application binaries but intentionally does not delete per-user WebView
or application data.

Before deleting settings, quit JL Mixing Studio completely. Move matching
directories to the Trash or Recycle Bin first so the operation is recoverable,
then relaunch to confirm a clean state.

### macOS

Inspect these per-user locations:

- `~/Library/Application Support/com.jlaudio.jlmixingstudio`
- `~/Library/WebKit/com.jlaudio.jlmixingstudio`
- `~/Library/Caches/com.jlaudio.jlmixingstudio`

Remove only directories whose name exactly matches the application identifier.

### Windows

Inspect these per-user locations:

- `%APPDATA%\com.jlaudio.jlmixingstudio`
- `%LOCALAPPDATA%\com.jlaudio.jlmixingstudio`

The Edge WebView2 data may be nested beneath the local application-data
directory. Remove only the exact JL Mixing Studio identifier directory.

## Release decision

- [x] Every tested platform and architecture has a recorded result.
- [x] The untested Apple Silicon platform is explicitly recorded as deferred.
- [x] No unresolved release-blocking defect remains.
- [x] Settings retention and removal behavior was verified on tested packaged builds.
- [x] Packaged workflows match the validated development build on Intel macOS.
- [x] Windows passed its defined limited acceptance scope.
- [x] `v1.0.0-rc.4` is approved as the final release candidate.

Issue #51 may be closed as part of the final `v1.0.0` release preparation.