use std::io;
use std::process::Command;

use crate::models::VersionCheck;

const JL_MIXING_EXECUTABLE: &str = "jl-mixing";
const VERSION_ARGUMENT: &str = "--version";

pub fn check_jl_mixing_version() -> VersionCheck {
    match Command::new(JL_MIXING_EXECUTABLE)
        .arg(VERSION_ARGUMENT)
        .output()
    {
        Ok(output) => evaluate_result(ProcessResult {
            success: output.status.success(),
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        }),
        Err(error) => evaluate_error(error),
    }
}

#[derive(Debug)]
struct ProcessResult {
    success: bool,
    exit_code: Option<i32>,
    stdout: String,
}

fn evaluate_error(error: io::Error) -> VersionCheck {
    if error.kind() == io::ErrorKind::NotFound {
        VersionCheck {
            available: false,
            version: None,
            message: "JL Mixing Automation was not found on PATH".into(),
        }
    } else {
        VersionCheck {
            available: false,
            version: None,
            message: "JL Mixing Automation could not be started".into(),
        }
    }
}

fn evaluate_result(output: ProcessResult) -> VersionCheck {
    if output.success {
        match parse_version(&output.stdout) {
            Some(version) => VersionCheck {
                available: true,
                message: format!("JL Mixing Automation {version} detected"),
                version: Some(version),
            },
            None => VersionCheck {
                available: false,
                version: None,
                message: "JL Mixing Automation returned unrecognized version output".into(),
            },
        }
    } else {
        VersionCheck {
            available: false,
            version: None,
            message: format!(
                "JL Mixing Automation version check failed with exit code {}",
                output.exit_code.map_or_else(|| "unknown".into(), |code| code.to_string())
            ),
        }
    }
}

fn parse_version(output: &str) -> Option<String> {
    let version = output
        .trim()
        .strip_prefix("jl-mixing ")?
        .trim();
    let parts: Vec<_> = version.split('.').collect();

    if parts.len() == 3
        && parts
            .iter()
            .all(|part| !part.is_empty() && part.chars().all(|character| character.is_ascii_digit()))
    {
        Some(version.to_owned())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_released_version_format() {
        assert_eq!(parse_version("jl-mixing 1.2.0\n"), Some("1.2.0".into()));
    }

    #[test]
    fn rejects_unrecognized_version_output() {
        assert_eq!(parse_version("version one"), None);
    }

    #[test]
    fn reports_missing_executable_without_exposing_system_details() {
        let result = evaluate_error(io::Error::new(io::ErrorKind::NotFound, "private path"));
        assert!(!result.available);
        assert_eq!(result.message, "JL Mixing Automation was not found on PATH");
    }

    #[test]
    fn reports_failed_process() {
        let result = evaluate_result(ProcessResult { success: false, exit_code: Some(2), stdout: String::new() });
        assert!(!result.available);
        assert_eq!(result.message, "JL Mixing Automation version check failed with exit code 2");
    }
}
