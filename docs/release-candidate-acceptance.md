# JL Mixing Studio 1.0 release-candidate acceptance results

Release candidate: `v1.0.0-rc.1`

Issue: [#51](https://github.com/JLAudio/jl-mixing-studio/issues/51)

Use this document to record testing performed against the downloadable installers
published by the release workflow. Do not mark a platform complete from a
development build or CI compilation alone.

## Installer identity

| Platform | Expected asset | Tester | OS version | Result |
| --- | --- | --- | --- | --- |
| Intel Mac | `JL-Mixing-Studio_1.0.0-rc.1_macos_x86_64.dmg` | jlevine | Monterey v12.7.6 | in progress |
| Apple Silicon Mac | `JL-Mixing-Studio_1.0.0-rc.1_macos_aarch64.dmg` |  |  | Not tested |
| Windows x64 | `JL-Mixing-Studio_1.0.0-rc.1_windows_x86_64.exe` |  |  | Not tested |

For each installer, verify its SHA-256 value against `SHA256SUMS.txt` before
bypassing Gatekeeper or SmartScreen.

## Platform acceptance matrix

Record Pass, Fail, or Not applicable for every row. Add concise evidence or a
linked issue for each failure.

| Test | Intel Mac | Apple Silicon Mac | Windows x64 | Evidence / issue |
| --- | --- | --- | --- | --- |
| Clean install without Node, Rust, Cargo, or source checkout | Passed | Not tested | Not tested | |
| Launch from Applications / Start menu | Passed | Not tested | Not tested | |
| Name, icon, version, architecture, and publisher metadata | Failed | Not tested | Not tested | Missing Application icon |
| Expected unsigned Gatekeeper / SmartScreen warning and documented bypass | Passed | Not tested | Not tested | |
| Default workspace discovery | Failed | Not tested | Not tested | Correctly detected mising workspace, but complained that "jq" was not installed when trying to create a new workspace. Note running "which jq" in a command terminal shows that it is installed and in the path. |
| Paths containing spaces | Not tested | Not tested | Not tested | |
| Paths containing non-ASCII characters | Not tested | Not tested | Not tested | |
| JL Mixing Automation missing | Passed | Not tested | Not tested | |
| JL Mixing Automation incompatible version rejected | Not tested | Not tested | Not tested | |
| JL Mixing Automation 1.3.0 detected and working | Failed | Not tested | Not applicable | Automation detected but all commands fail with can't find 'jq' |
| Intake report reading and validation | Not tested | Not tested | Not applicable | |
| Revision creation and approval | Not tested | Not tested | Not applicable | |
| Automation 1.3.0 delivery creation | Not tested | Not tested | Not applicable | |
| Copy Path and Open Folder actions | Not tested | Not tested | Not tested | |
| Upgrade from previous release candidate preserves settings | Not tested | Not tested | Not tested | |
| Uninstall removes application binaries | Passed | Not tested | Not tested | |
| Uninstall retains settings | Not tested | Not tested | Not tested | |
| Reinstall reuses retained settings | Not tested | Not tested | Not tested | |
| Manual settings removal resets the application | Not tested | Not tested | Not tested | |

Windows does not support JL Mixing Automation 1.3.0. Windows must report guided
Automation workflows as unavailable while preserving supported workspace
browsing and report-reading behavior.

## Test sequence

1. Use a disposable OS account and disposable `~/Music/Mixes` workspace.
2. Confirm no development dependencies or source checkout are required.
3. Verify the downloaded checksum.
4. Install and launch through the normal OS shortcut.
5. Exercise the applicable 1.0-critical workflows in the matrix.
6. Record application identity and the expected unsigned-install warning.
7. Install the next release candidate over the prior candidate and confirm
   retained settings are unchanged.
8. Uninstall the application and confirm its binaries are removed.
9. Reinstall and confirm retained settings are reused.
10. Remove the retained settings manually, relaunch, and confirm a clean state.
11. File every release-blocking defect separately and link it in the matrix.

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
Record the locations actually created by the packaged application during
acceptance testing; delete nonexistent entries from the final user
documentation.

### Windows

Inspect these per-user locations:

- `%APPDATA%\com.jlaudio.jlmixingstudio`
- `%LOCALAPPDATA%\com.jlaudio.jlmixingstudio`

The Edge WebView2 data may be nested beneath the local application-data
directory. Remove only the exact JL Mixing Studio identifier directory. Record
the locations actually created by the packaged application during acceptance
testing and use those verified paths in the final user documentation.

## Release decision

- [ ] Every supported platform and architecture has a recorded result.
- [ ] No unresolved release-blocking defect remains.
- [ ] Settings locations and removal steps were verified on packaged builds.
- [ ] Packaged workflows match the validated development build.
- [ ] Issue #51 can be closed before the final `v1.0.0` tag is published.
