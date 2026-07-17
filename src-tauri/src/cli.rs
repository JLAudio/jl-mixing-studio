use std::env;
use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::models::{
    ClientCreationRequest, ClientCreationSummary, ClientOperationCode, ClientOperationResult,
    VersionCheck,
};

const CLIENT_EXECUTABLE: &str = "new-client";
const VERSION_FILE: &str = "VERSION";
const SUPPORTED_VERSION: &str = "1.2.0";
const MAX_VERSION_FILE_BYTES: usize = 64;
const MAX_PROCESS_MESSAGE_CHARS: usize = 1_000;

pub fn check_jl_mixing_version(home: &Path) -> VersionCheck {
    check_version_with_runner(home, &SystemProcessRunner)
}

pub fn preflight_client_creation(
    home: &Path,
    workspace: &Path,
    request: ClientCreationRequest,
) -> ClientOperationResult {
    run_client_operation(
        home,
        workspace,
        request,
        ClientOperation::Preflight,
        &SystemProcessRunner,
    )
}

pub fn create_client(
    home: &Path,
    workspace: &Path,
    request: ClientCreationRequest,
) -> ClientOperationResult {
    run_client_operation(
        home,
        workspace,
        request,
        ClientOperation::Create,
        &SystemProcessRunner,
    )
}

pub fn blocked_client_operation(code: ClientOperationCode, message: &str) -> ClientOperationResult {
    ClientOperationResult {
        ok: false,
        code,
        message: message.to_owned(),
        client: None,
    }
}

trait ProcessRunner {
    fn run(
        &self,
        executable: &Path,
        arguments: &[String],
        current_directory: Option<&Path>,
    ) -> io::Result<ProcessResult>;
}

struct SystemProcessRunner;

impl ProcessRunner for SystemProcessRunner {
    fn run(
        &self,
        executable: &Path,
        arguments: &[String],
        current_directory: Option<&Path>,
    ) -> io::Result<ProcessResult> {
        let mut command = Command::new(executable);
        command.args(arguments);
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

#[derive(Debug)]
struct ProcessResult {
    success: bool,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

#[derive(Clone, Copy)]
enum ClientOperation {
    Preflight,
    Create,
}

fn run_client_operation<R: ProcessRunner>(
    home: &Path,
    workspace: &Path,
    request: ClientCreationRequest,
    operation: ClientOperation,
    runner: &R,
) -> ClientOperationResult {
    let client = match normalize_request(request) {
        Ok(client) => client,
        Err(message) => {
            return blocked_client_operation(ClientOperationCode::InvalidInput, &message)
        }
    };

    let version = check_version_with_runner(home, runner);
    if !version.available {
        return blocked_client_operation(
            ClientOperationCode::AutomationUnavailable,
            &version.message,
        );
    }
    if !version.supported {
        return blocked_client_operation(ClientOperationCode::UnsupportedVersion, &version.message);
    }

    let Some(executable) = resolve_command(home, CLIENT_EXECUTABLE) else {
        return blocked_client_operation(
            ClientOperationCode::AutomationUnavailable,
            "The JL Mixing Automation new-client command was not found",
        );
    };
    let arguments = client_arguments(&client, operation);
    match runner.run(&executable, &arguments, Some(workspace)) {
        Ok(output) if output.success => ClientOperationResult {
            ok: true,
            code: match operation {
                ClientOperation::Preflight => ClientOperationCode::Ready,
                ClientOperation::Create => ClientOperationCode::Created,
            },
            message: match operation {
                ClientOperation::Preflight => "Preflight passed. No changes were made.",
                ClientOperation::Create => "Client created successfully.",
            }
            .to_owned(),
            client: Some(client),
        },
        Ok(output) => rejected_operation(output, client),
        Err(error) if error.kind() == io::ErrorKind::NotFound => blocked_client_operation(
            ClientOperationCode::AutomationUnavailable,
            "The JL Mixing Automation new-client command was not found",
        ),
        Err(_) => blocked_client_operation(
            ClientOperationCode::Failed,
            "The JL Mixing Automation new-client command could not be started",
        ),
    }
}

fn normalize_request(request: ClientCreationRequest) -> Result<ClientCreationSummary, String> {
    let client_id = request.client_id.trim().to_owned();
    let client_name = request.client_name.trim().to_owned();
    let default_artist = request
        .default_artist
        .map(|artist| artist.trim().to_owned())
        .filter(|artist| !artist.is_empty());

    if client_id.is_empty() {
        return Err("Client ID is required".into());
    }
    if !is_valid_client_id(&client_id) {
        return Err(
            "Client ID must use lowercase letters and numbers separated by single hyphens".into(),
        );
    }
    if client_name.is_empty() {
        return Err("Client name is required".into());
    }
    if client_name.chars().any(char::is_control) {
        return Err("Client name cannot contain control characters".into());
    }
    if default_artist
        .as_ref()
        .is_some_and(|artist| artist.chars().any(char::is_control))
    {
        return Err("Default artist cannot contain control characters".into());
    }

    Ok(ClientCreationSummary {
        client_id,
        client_name,
        default_artist,
    })
}

fn is_valid_client_id(value: &str) -> bool {
    value.split('-').all(|part| {
        !part.is_empty()
            && part
                .chars()
                .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
    })
}

fn client_arguments(client: &ClientCreationSummary, operation: ClientOperation) -> Vec<String> {
    let mut arguments = vec![
        client.client_id.clone(),
        "--name".into(),
        client.client_name.clone(),
    ];
    if let Some(artist) = &client.default_artist {
        arguments.push("--artist".into());
        arguments.push(artist.clone());
    }
    match operation {
        ClientOperation::Preflight => arguments.push("--dry-run".into()),
        ClientOperation::Create => arguments.push("--no-cd".into()),
    }
    arguments
}

fn rejected_operation(
    output: ProcessResult,
    client: ClientCreationSummary,
) -> ClientOperationResult {
    let fallback = format!(
        "JL Mixing Automation rejected the client request with exit code {}",
        output
            .exit_code
            .map_or_else(|| "unknown".into(), |code| code.to_string())
    );
    let message = bounded_process_message(&output.stderr, &output.stdout, &fallback);
    let normalized = message.to_ascii_lowercase();
    let collision = normalized.contains("already exists")
        || normalized.contains("already used")
        || normalized.contains("already in use")
        || normalized.contains("collision");

    ClientOperationResult {
        ok: false,
        code: if collision {
            ClientOperationCode::Collision
        } else {
            ClientOperationCode::Rejected
        },
        message,
        client: Some(client),
    }
}

fn check_version_with_runner<R: ProcessRunner>(home: &Path, runner: &R) -> VersionCheck {
    let Some(executable) = resolve_command(home, CLIENT_EXECUTABLE) else {
        return unavailable_version(
            "JL Mixing Automation was not found in its default install location or on PATH",
        );
    };
    let Some(version_file) = version_file_for_command(&executable) else {
        return unavailable_version(
            "The JL Mixing Automation installation location could not be verified",
        );
    };
    let version = match read_version_file(&version_file) {
        Ok(version) => version,
        Err(message) => return unavailable_version(message),
    };

    let arguments = vec!["--help".to_owned()];
    match runner.run(&executable, &arguments, None) {
        Ok(output) if output.success => evaluate_version(&version),
        Ok(output) => unavailable_version(&format!(
            "JL Mixing Automation health check failed with exit code {}",
            output
                .exit_code
                .map_or_else(|| "unknown".into(), |code| code.to_string())
        )),
        Err(error) => evaluate_health_check_error(error),
    }
}

fn resolve_command(home: &Path, executable: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH");
    resolve_command_with_path(home, executable, path.as_deref())
}

fn resolve_command_with_path(
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

fn version_file_for_command(executable: &Path) -> Option<PathBuf> {
    let bin_directory = executable.parent()?;
    if bin_directory.file_name()? != OsStr::new("bin") {
        return None;
    }
    let prefix = bin_directory.parent()?;
    Some(prefix.join("share").join("jl-mixing").join(VERSION_FILE))
}

fn read_version_file(path: &Path) -> Result<String, &'static str> {
    let bytes = fs::read(path)
        .map_err(|_| "The JL Mixing Automation VERSION file could not be read")?;
    if bytes.len() > MAX_VERSION_FILE_BYTES {
        return Err("The JL Mixing Automation VERSION file is invalid");
    }
    let text = std::str::from_utf8(&bytes)
        .map_err(|_| "The JL Mixing Automation VERSION file is invalid")?;
    parse_version(text).ok_or("The JL Mixing Automation VERSION file is invalid")
}

fn evaluate_health_check_error(error: io::Error) -> VersionCheck {
    let message = if error.kind() == io::ErrorKind::NotFound {
        "JL Mixing Automation was not found in its default install location or on PATH"
    } else {
        "JL Mixing Automation could not be started"
    };
    unavailable_version(message)
}

fn evaluate_version(version: &str) -> VersionCheck {
    let supported = version == SUPPORTED_VERSION;
    VersionCheck {
        available: true,
        supported,
        client_creation_supported: supported && !cfg!(target_os = "windows"),
        message: if supported {
            format!("JL Mixing Automation {version} detected")
        } else {
            format!(
                "JL Mixing Automation {version} detected; client creation requires {SUPPORTED_VERSION}"
            )
        },
        version: Some(version.to_owned()),
    }
}

fn unavailable_version(message: &str) -> VersionCheck {
    VersionCheck {
        available: false,
        supported: false,
        client_creation_supported: false,
        version: None,
        message: message.to_owned(),
    }
}

fn parse_version(input: &str) -> Option<String> {
    let version = input.trim();
    let parts: Vec<_> = version.split('.').collect();

    if parts.len() == 3
        && parts.iter().all(|part| {
            !part.is_empty() && part.chars().all(|character| character.is_ascii_digit())
        })
    {
        Some(version.to_owned())
    } else {
        None
    }
}

fn bounded_process_message(stderr: &str, stdout: &str, fallback: &str) -> String {
    let source = if !stderr.trim().is_empty() {
        stderr
    } else if !stdout.trim().is_empty() {
        stdout
    } else {
        fallback
    };
    let filtered: String = source
        .trim()
        .chars()
        .filter(|character| !character.is_control() || *character == '\n' || *character == '\t')
        .take(MAX_PROCESS_MESSAGE_CHARS)
        .collect();
    if filtered.is_empty() {
        fallback.to_owned()
    } else {
        filtered
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::collections::VecDeque;

    use super::*;

    #[derive(Debug, PartialEq, Eq)]
    struct Invocation {
        executable: PathBuf,
        arguments: Vec<String>,
        current_directory: Option<PathBuf>,
    }

    struct FakeRunner {
        results: RefCell<VecDeque<io::Result<ProcessResult>>>,
        invocations: RefCell<Vec<Invocation>>,
    }

    impl FakeRunner {
        fn new(results: Vec<io::Result<ProcessResult>>) -> Self {
            Self {
                results: RefCell::new(results.into()),
                invocations: RefCell::new(Vec::new()),
            }
        }
    }

    impl ProcessRunner for FakeRunner {
        fn run(
            &self,
            executable: &Path,
            arguments: &[String],
            current_directory: Option<&Path>,
        ) -> io::Result<ProcessResult> {
            self.invocations.borrow_mut().push(Invocation {
                executable: executable.to_owned(),
                arguments: arguments.to_vec(),
                current_directory: current_directory.map(Path::to_owned),
            });
            self.results
                .borrow_mut()
                .pop_front()
                .expect("a fake process result")
        }
    }

    fn success(stdout: &str) -> io::Result<ProcessResult> {
        Ok(ProcessResult {
            success: true,
            exit_code: Some(0),
            stdout: stdout.into(),
            stderr: String::new(),
        })
    }

    fn failure(code: i32, stderr: &str) -> io::Result<ProcessResult> {
        Ok(ProcessResult {
            success: false,
            exit_code: Some(code),
            stdout: String::new(),
            stderr: stderr.into(),
        })
    }

    fn request(artist: Option<&str>) -> ClientCreationRequest {
        ClientCreationRequest {
            client_id: "acme-records".into(),
            client_name: " Acme Records ".into(),
            default_artist: artist.map(str::to_owned),
        }
    }

    fn installed_home(version: &str) -> tempfile::TempDir {
        let home = tempfile::tempdir().unwrap();
        let bin = home.path().join(".local/bin");
        let application = home.path().join(".local/share/jl-mixing");
        std::fs::create_dir_all(&bin).unwrap();
        std::fs::create_dir_all(&application).unwrap();
        std::fs::write(bin.join(CLIENT_EXECUTABLE), "managed launcher").unwrap();
        std::fs::write(application.join(VERSION_FILE), format!("{version}\n")).unwrap();
        home
    }

    #[test]
    fn accepts_only_the_released_supported_version_for_creation() {
        let supported = evaluate_version("1.2.0");
        assert!(supported.available);
        assert!(supported.supported);

        let future = evaluate_version("1.3.0");
        assert!(future.available);
        assert!(!future.supported);
        assert!(future.message.contains("requires 1.2.0"));
    }

    #[test]
    fn rejects_unrecognized_version_output() {
        assert_eq!(parse_version("version one"), None);
        assert_eq!(parse_version("jl-mixing 1.2.0"), None);
    }

    #[test]
    fn reports_missing_executable_without_exposing_system_details() {
        let result =
            evaluate_health_check_error(io::Error::new(io::ErrorKind::NotFound, "private path"));
        assert!(!result.available);
        assert!(result
            .message
            .contains("default install location or on PATH"));
    }

    #[test]
    fn prefers_the_documented_default_install_location() {
        let home = installed_home(SUPPORTED_VERSION);
        assert_eq!(
            resolve_command_with_path(home.path(), CLIENT_EXECUTABLE, None),
            Some(home.path().join(".local/bin").join(CLIENT_EXECUTABLE))
        );
    }

    #[test]
    fn resolves_a_documented_custom_prefix_from_path() {
        let home = tempfile::tempdir().unwrap();
        let prefix = tempfile::tempdir().unwrap();
        let bin = prefix.path().join("bin");
        std::fs::create_dir_all(&bin).unwrap();
        std::fs::write(bin.join(CLIENT_EXECUTABLE), "managed launcher").unwrap();
        let search_path = env::join_paths([&bin]).unwrap();

        let executable = resolve_command_with_path(
            home.path(),
            CLIENT_EXECUTABLE,
            Some(search_path.as_os_str()),
        )
        .unwrap();
        assert_eq!(executable, bin.join(CLIENT_EXECUTABLE));
        assert_eq!(
            version_file_for_command(&executable),
            Some(prefix.path().join("share/jl-mixing/VERSION"))
        );
    }

    #[test]
    fn rejects_missing_or_invalid_version_metadata_without_running_a_command() {
        let home = installed_home("not-a-version");
        let runner = FakeRunner::new(Vec::new());
        let result = check_version_with_runner(home.path(), &runner);

        assert!(!result.available);
        assert!(result.message.contains("VERSION file is invalid"));
        assert!(runner.invocations.borrow().is_empty());
    }

    #[test]
    fn checks_new_client_health_after_reading_the_installed_version() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("Usage: new-client CLIENT_ID [options]")]);
        let result = check_version_with_runner(home.path(), &runner);

        assert!(result.available);
        assert!(result.supported);
        assert_eq!(result.version.as_deref(), Some(SUPPORTED_VERSION));
        assert_eq!(runner.invocations.borrow().len(), 1);
        assert_eq!(
            runner.invocations.borrow()[0].arguments,
            vec!["--help"]
        );
    }

    #[test]
    fn preflight_uses_dry_run_without_directory_change_flags() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("help"), success("preview")]);
        let workspace = Path::new("/fixed/workspace");
        let result = run_client_operation(
            home.path(),
            workspace,
            request(Some(" The Artist ")),
            ClientOperation::Preflight,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, ClientOperationCode::Ready);
        let invocations = runner.invocations.borrow();
        assert_eq!(invocations.len(), 2);
        assert_eq!(
            invocations[1].executable,
            home.path().join(".local/bin/new-client")
        );
        assert_eq!(
            invocations[1].arguments,
            vec![
                "acme-records",
                "--name",
                "Acme Records",
                "--artist",
                "The Artist",
                "--dry-run"
            ]
        );
        assert!(!invocations[1].arguments.contains(&"--no-cd".into()));
        assert_eq!(invocations[1].current_directory, Some(workspace.to_owned()));
    }

    #[test]
    fn confirmed_creation_uses_no_cd_and_omits_empty_artist() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![success("help"), success("created")]);
        let result = run_client_operation(
            home.path(),
            Path::new("/fixed/workspace"),
            request(Some("   ")),
            ClientOperation::Create,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, ClientOperationCode::Created);
        assert_eq!(
            runner.invocations.borrow()[1].arguments,
            vec!["acme-records", "--name", "Acme Records", "--no-cd"]
        );
    }

    #[test]
    fn invalid_input_never_starts_a_process() {
        let runner = FakeRunner::new(Vec::new());
        let mut invalid = request(None);
        invalid.client_id = "Not Valid".into();
        let result = run_client_operation(
            Path::new("/home/tester"),
            Path::new("/fixed/workspace"),
            invalid,
            ClientOperation::Preflight,
            &runner,
        );
        assert_eq!(result.code, ClientOperationCode::InvalidInput);
        assert!(runner.invocations.borrow().is_empty());
    }

    #[test]
    fn unsupported_version_never_starts_new_client() {
        let home = installed_home("2.0.0");
        let runner = FakeRunner::new(vec![success("help")]);
        let result = run_client_operation(
            home.path(),
            Path::new("/fixed/workspace"),
            request(None),
            ClientOperation::Preflight,
            &runner,
        );
        assert_eq!(result.code, ClientOperationCode::UnsupportedVersion);
        assert_eq!(runner.invocations.borrow().len(), 1);
    }

    #[test]
    fn reports_collision_from_rejected_dry_run() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            failure(4, "Client destination already exists"),
        ]);
        let result = run_client_operation(
            home.path(),
            Path::new("/fixed/workspace"),
            request(None),
            ClientOperation::Preflight,
            &runner,
        );
        assert!(!result.ok);
        assert_eq!(result.code, ClientOperationCode::Collision);
        assert!(result.message.contains("already exists"));
    }

    #[test]
    fn reports_missing_new_client_separately() {
        let home = installed_home(SUPPORTED_VERSION);
        let runner = FakeRunner::new(vec![
            success("help"),
            Err(io::Error::new(io::ErrorKind::NotFound, "missing")),
        ]);
        let result = run_client_operation(
            home.path(),
            Path::new("/fixed/workspace"),
            request(None),
            ClientOperation::Create,
            &runner,
        );
        assert_eq!(result.code, ClientOperationCode::AutomationUnavailable);
        assert!(result.message.contains("new-client"));
    }

    #[test]
    fn bounds_process_error_output() {
        let message = "x".repeat(MAX_PROCESS_MESSAGE_CHARS + 20);
        let result = rejected_operation(
            failure(1, &message).unwrap(),
            ClientCreationSummary {
                client_id: "acme".into(),
                client_name: "Acme".into(),
                default_artist: None,
            },
        );
        assert_eq!(result.message.chars().count(), MAX_PROCESS_MESSAGE_CHARS);
    }
}
