//! Shared JL Mixing Automation process boundary for Studio-side integrations.

use std::env;
use std::ffi::OsStr;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

const HOMEBREW_COMMAND_PATHS: [&str; 2] = ["/usr/local/bin", "/opt/homebrew/bin"];

pub(crate) trait ProcessRunner {
    fn run(
        &self,
        executable: &Path,
        arguments: &[String],
        current_directory: Option<&Path>,
    ) -> io::Result<ProcessResult>;
}

pub(crate) struct SystemProcessRunner;

impl ProcessRunner for SystemProcessRunner {
    fn run(
        &self,
        executable: &Path,
        arguments: &[String],
        current_directory: Option<&Path>,
    ) -> io::Result<ProcessResult> {
        let mut command = Command::new(executable);
        command.args(arguments);
        if let Some(path) = automation_subprocess_path(env::var_os("PATH").as_deref()) {
            command.env("PATH", path);
        }
        if let Some(directory) = current_directory {
            command.current_dir(directory);
        }
        let output = command.output()?;
        Ok(ProcessResult {
            success: output.status.success(),
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }
}

pub(crate) fn automation_subprocess_path(
    inherited_path: Option<&OsStr>,
) -> Option<std::ffi::OsString> {
    let mut paths: Vec<PathBuf> = inherited_path
        .map(env::split_paths)
        .into_iter()
        .flatten()
        .collect();

    for path in HOMEBREW_COMMAND_PATHS {
        let path = PathBuf::from(path);
        if !paths.contains(&path) {
            paths.push(path);
        }
    }

    env::join_paths(paths).ok()
}

pub(crate) fn resolve_command(home: &Path, executable: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH");
    resolve_command_with_path(home, executable, path.as_deref())
}

pub(crate) fn resolve_command_with_path(
    home: &Path,
    executable: &str,
    search_path: Option<&OsStr>,
) -> Option<PathBuf> {
    let default_install = home.join(".local").join("bin").join(executable);
    if default_install.is_file() {
        return Some(default_install);
    }

    search_path.and_then(|value| {
        env::split_paths(value)
            .map(|directory| directory.join(executable))
            .find(|candidate| candidate.is_file())
    })
}

#[derive(Debug)]
pub(crate) struct ProcessResult {
    pub(crate) success: bool,
    pub(crate) exit_code: Option<i32>,
    pub(crate) stdout: String,
    pub(crate) stderr: String,
}
