//! Shared JL Mixing Automation process boundary and compatibility discovery.

use std::env;
use std::ffi::OsStr;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Deserialize;

use crate::models::VersionCheck;

pub(crate) const AUTOMATION_EXECUTABLE: &str = "jl-mixing";
const SUPPORTED_API_VERSION: &str = "1.0";
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

/// GUI launches on macOS may not inherit the user's interactive shell PATH. Keep the
/// inherited search order, then add the standard Intel and Apple Silicon Homebrew locations so
/// Automation discovery behaves consistently without overriding an explicitly configured binary.
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

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ApiStatus {
    Success,
    Planned,
    Blocked,
    Error,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ApiError {
    pub(crate) code: String,
    pub(crate) message: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ApiResponse {
    api_version: String,
    operation: String,
    pub(crate) status: ApiStatus,
    pub(crate) data: serde_json::Value,
    pub(crate) errors: Vec<ApiError>,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum ApiCallError {
    Unavailable,
    StartFailed,
    Malformed,
    IncompatibleVersion(String),
    UnexpectedOperation(String),
}

impl ApiCallError {
    pub(crate) fn message(&self) -> String {
        match self {
            Self::Unavailable => {
                "JL Mixing Automation was not found in its default install location or on PATH"
                    .into()
            }
            Self::StartFailed => "JL Mixing Automation could not be started".into(),
            Self::Malformed => "JL Mixing Automation returned a malformed API response".into(),
            Self::IncompatibleVersion(version) => format!(
                "JL Mixing Automation returned API {}; Studio requires Automation API {}",
                version, SUPPORTED_API_VERSION
            ),
            Self::UnexpectedOperation(operation) => format!(
                "JL Mixing Automation returned an unexpected API operation: {}",
                operation
            ),
        }
    }
}

pub(crate) fn invoke_api<R: ProcessRunner>(
    home: &Path,
    expected_operation: &str,
    arguments: &[String],
    current_directory: Option<&Path>,
    runner: &R,
) -> Result<ApiResponse, ApiCallError> {
    let Some(executable) = resolve_command(home, AUTOMATION_EXECUTABLE) else {
        return Err(ApiCallError::Unavailable);
    };
    let output = runner
        .run(&executable, arguments, current_directory)
        .map_err(|error| {
            if error.kind() == io::ErrorKind::NotFound {
                ApiCallError::Unavailable
            } else {
                ApiCallError::StartFailed
            }
        })?;
    let response: ApiResponse =
        serde_json::from_str(output.stdout.trim()).map_err(|_| ApiCallError::Malformed)?;
    if response.api_version != SUPPORTED_API_VERSION {
        return Err(ApiCallError::IncompatibleVersion(response.api_version));
    }
    if response.operation != expected_operation {
        return Err(ApiCallError::UnexpectedOperation(response.operation));
    }
    Ok(response)
}

pub(crate) fn check_automation_compatibility<R: ProcessRunner>(
    home: &Path,
    runner: &R,
) -> VersionCheck {
    let discovery = match load_automation_discovery(home, runner) {
        Ok(discovery) => discovery,
        Err(result) => return result,
    };
    let (api_version, application, capabilities) = match validate_discovery(discovery) {
        Ok(validated) => validated,
        Err(result) => return result,
    };
    compatibility_result(&api_version, &application, &capabilities)
}

fn load_automation_discovery<R: ProcessRunner>(
    home: &Path,
    runner: &R,
) -> Result<DiscoveryDocument, VersionCheck> {
    let Some(executable) = resolve_command(home, AUTOMATION_EXECUTABLE) else {
        return Err(unavailable_version(
            "JL Mixing Automation was not found in its default install location or on PATH",
        ));
    };

    let arguments = vec!["system-info".to_owned(), "--json".to_owned()];
    let output = match runner.run(&executable, &arguments, None) {
        Ok(output) if output.success => output,
        Ok(output) => {
            return Err(unavailable_version(&format!(
                "JL Mixing Automation discovery failed with exit code {}",
                output
                    .exit_code
                    .map_or_else(|| "unknown".into(), |code| code.to_string())
            )))
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Err(unavailable_version(
                "JL Mixing Automation was not found in its default install location or on PATH",
            ))
        }
        Err(_) => {
            return Err(unavailable_version(
                "JL Mixing Automation discovery could not be started",
            ))
        }
    };

    serde_json::from_str(output.stdout.trim()).map_err(|_| {
        unavailable_version("JL Mixing Automation returned a malformed discovery response")
    })
}

fn validate_discovery(
    discovery: DiscoveryDocument,
) -> Result<(String, DiscoveryApplication, Vec<String>), VersionCheck> {
    let Some(api_version) = discovery
        .api_version
        .filter(|value| !value.trim().is_empty())
    else {
        return Err(unavailable_version(
            "JL Mixing Automation did not declare an Automation API version",
        ));
    };

    let Some(application) = discovery.application else {
        return Err(unavailable_version(
            "JL Mixing Automation discovery response did not identify the provider application",
        ));
    };
    if application.name != AUTOMATION_EXECUTABLE || application.version.trim().is_empty() {
        return Err(unavailable_version(
            "JL Mixing Automation discovery response did not identify a valid provider application",
        ));
    }

    let Some(capabilities) = discovery.capabilities else {
        return Err(unavailable_version(
            "JL Mixing Automation discovery response did not declare provider capabilities",
        ));
    };

    Ok((api_version, application, capabilities))
}

fn compatibility_result(
    api_version: &str,
    application: &DiscoveryApplication,
    capabilities: &[String],
) -> VersionCheck {
    if api_version != SUPPORTED_API_VERSION {
        return VersionCheck {
            available: true,
            supported: false,
            studio_creation_supported: false,
            client_creation_supported: false,
            project_creation_supported: false,
            intake_validation_supported: false,
            revision_creation_supported: false,
            revision_approval_supported: false,
            delivery_creation_supported: false,
            version: Some(application.version.clone()),
            message: format!(
                "JL Mixing Automation {} exposes API {}; Studio requires Automation API {}",
                application.version, api_version, SUPPORTED_API_VERSION
            ),
        };
    }

    let platform_supported = !cfg!(target_os = "windows");
    // Feature availability follows provider-advertised API capabilities rather than Automation's
    // product version, preserving Studio/Automation version independence within API 1.0.
    let has = |capability: &str| capabilities.iter().any(|item| item == capability);

    VersionCheck {
        available: true,
        supported: true,
        // Studio workspace creation is not yet an Automation API 1.0 capability. Preserve the
        // existing platform gate while the API-backed workflows migrate independently.
        studio_creation_supported: platform_supported,
        client_creation_supported: platform_supported && has("client.create"),
        project_creation_supported: platform_supported
            && has("project.create")
            && has("project.create.artist"),
        intake_validation_supported: platform_supported
            && has("intake.validate")
            && has("intake.validate.report"),
        revision_creation_supported: platform_supported
            && has("revision.create")
            && has("revision.create.description"),
        revision_approval_supported: platform_supported && has("revision.approve"),
        delivery_creation_supported: platform_supported && has("delivery.create"),
        version: Some(application.version.clone()),
        message: format!(
            "JL Mixing Automation {} detected with compatible Automation API {}",
            application.version, api_version
        ),
    }
}

fn unavailable_version(message: &str) -> VersionCheck {
    VersionCheck {
        available: false,
        supported: false,
        studio_creation_supported: false,
        client_creation_supported: false,
        project_creation_supported: false,
        intake_validation_supported: false,
        revision_creation_supported: false,
        revision_approval_supported: false,
        delivery_creation_supported: false,
        version: None,
        message: message.to_owned(),
    }
}

#[derive(Debug, Deserialize)]
struct DiscoveryDocument {
    api_version: Option<String>,
    application: Option<DiscoveryApplication>,
    capabilities: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct DiscoveryApplication {
    name: String,
    version: String,
}

#[derive(Debug)]
pub(crate) struct ProcessResult {
    pub(crate) success: bool,
    pub(crate) exit_code: Option<i32>,
    pub(crate) stdout: String,
    pub(crate) stderr: String,
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::collections::VecDeque;
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    struct FakeRunner {
        results: RefCell<VecDeque<io::Result<ProcessResult>>>,
    }

    impl FakeRunner {
        fn new(results: Vec<io::Result<ProcessResult>>) -> Self {
            Self {
                results: RefCell::new(results.into()),
            }
        }
    }

    impl ProcessRunner for FakeRunner {
        fn run(
            &self,
            _executable: &Path,
            _arguments: &[String],
            _current_directory: Option<&Path>,
        ) -> io::Result<ProcessResult> {
            self.results
                .borrow_mut()
                .pop_front()
                .expect("expected fake process result")
        }
    }

    fn installed_home() -> tempfile::TempDir {
        let home = tempdir().expect("temporary home");
        let bin = home.path().join(".local/bin");
        fs::create_dir_all(&bin).expect("create bin");
        fs::write(bin.join(AUTOMATION_EXECUTABLE), "stub").expect("create executable stub");
        home
    }

    fn success(stdout: &str) -> io::Result<ProcessResult> {
        Ok(ProcessResult {
            success: true,
            exit_code: Some(0),
            stdout: stdout.to_owned(),
            stderr: String::new(),
        })
    }

    #[test]
    fn missing_provider_is_unavailable() {
        let home = tempdir().expect("temporary home");
        let result = check_automation_compatibility(home.path(), &FakeRunner::new(vec![]));
        assert!(!result.available);
        assert!(!result.supported);
        assert!(result.message.contains("not found"));
    }

    #[test]
    fn compatible_api_uses_advertised_capabilities() {
        let home = installed_home();
        let discovery = r#"{
            "api_version":"1.0",
            "application":{"name":"jl-mixing","version":"1.9.4"},
            "capabilities":["system.info","client.create","project.create","project.create.artist","revision.create","revision.create.description","intake.validate","intake.validate.report","revision.approve","delivery.create"]
        }"#;
        let result =
            check_automation_compatibility(home.path(), &FakeRunner::new(vec![success(discovery)]));
        assert!(result.available);
        assert!(result.supported);
        assert_eq!(result.version.as_deref(), Some("1.9.4"));
        if !cfg!(target_os = "windows") {
            assert!(result.client_creation_supported);
            assert!(result.project_creation_supported);
            assert!(result.intake_validation_supported);
            assert!(result.revision_creation_supported);
            assert!(result.revision_approval_supported);
            assert!(result.delivery_creation_supported);
        }
    }

    #[test]
    fn incompatible_api_is_rejected_independently_of_product_version() {
        let home = installed_home();
        let discovery = r#"{
            "api_version":"2.0",
            "application":{"name":"jl-mixing","version":"1.3.1"},
            "capabilities":["system.info","client.create"]
        }"#;
        let result =
            check_automation_compatibility(home.path(), &FakeRunner::new(vec![success(discovery)]));
        assert!(result.available);
        assert!(!result.supported);
        assert_eq!(result.version.as_deref(), Some("1.3.1"));
        assert!(result.message.contains("requires Automation API 1.0"));
    }

    #[test]
    fn malformed_discovery_is_unavailable() {
        let home = installed_home();
        let result = check_automation_compatibility(
            home.path(),
            &FakeRunner::new(vec![success("not-json")]),
        );
        assert!(!result.available);
        assert!(result.message.contains("malformed discovery response"));
    }

    #[test]
    fn missing_capability_disables_only_that_workflow() {
        let home = installed_home();
        let discovery = r#"{
            "api_version":"1.0",
            "application":{"name":"jl-mixing","version":"2.0.0"},
            "capabilities":["system.info","client.create"]
        }"#;
        let result =
            check_automation_compatibility(home.path(), &FakeRunner::new(vec![success(discovery)]));
        assert!(result.supported);
        if !cfg!(target_os = "windows") {
            assert!(result.client_creation_supported);
            assert!(!result.project_creation_supported);
            assert!(!result.delivery_creation_supported);
        }
    }
}
