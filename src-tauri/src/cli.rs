use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::models::{
    ClientCreationRequest, ClientCreationSummary, ClientOperationCode, ClientOperationResult,
    VersionCheck,
};

const VERSION_EXECUTABLE: &str = "jl-mixing";
const CLIENT_EXECUTABLE: &str = "new-client";
const SUPPORTED_VERSION: &str = "1.2.0";
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

    let executable = resolve_command(home, CLIENT_EXECUTABLE);
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
    let executable = resolve_command(home, VERSION_EXECUTABLE);
    let arguments = vec!["--version".to_owned()];
    match runner.run(&executable, &arguments, None) {
        Ok(output) => evaluate_version_result(output),
        Err(error) => evaluate_version_error(error),
    }
}

fn resolve_command(home: &Path, executable: &str) -> PathBuf {
    let default_install = home.join(".local").join("bin").join(executable);
    if default_install.is_file() {
        default_install
    } else {
        PathBuf::from(executable)
    }
}

fn evaluate_version_error(error: io::Error) -> VersionCheck {
    let message = if error.kind() == io::ErrorKind::NotFound {
        "JL Mixing Automation was not found in its default install location or on PATH"
    } else {
        "JL Mixing Automation could not be started"
    };
    VersionCheck {
        available: false,
        supported: false,
        client_creation_supported: false,
        version: None,
        message: message.into(),
    }
}

fn evaluate_version_result(output: ProcessResult) -> VersionCheck {
    if output.success {
        match parse_version(&output.stdout) {
            Some(version) => {
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
                    version: Some(version),
                }
            }
            None => VersionCheck {
                available: false,
                supported: false,
                client_creation_supported: false,
                version: None,
                message: "JL Mixing Automation returned unrecognized version output".into(),
            },
        }
    } else {
        VersionCheck {
            available: false,
            supported: false,
            client_creation_supported: false,
            version: None,
            message: format!(
                "JL Mixing Automation version check failed with exit code {}",
                output
                    .exit_code
                    .map_or_else(|| "unknown".into(), |code| code.to_string())
            ),
        }
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

fn parse_version(output: &str) -> Option<String> {
    let version = output.trim().strip_prefix("jl-mixing ")?.trim();
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

    #[test]
    fn accepts_only_the_released_supported_version_for_creation() {
        let supported = evaluate_version_result(success("jl-mixing 1.2.0\n").unwrap());
        assert!(supported.available);
        assert!(supported.supported);

        let future = evaluate_version_result(success("jl-mixing 1.3.0\n").unwrap());
        assert!(future.available);
        assert!(!future.supported);
        assert!(future.message.contains("requires 1.2.0"));
    }

    #[test]
    fn rejects_unrecognized_version_output() {
        assert_eq!(parse_version("version one"), None);
        let result = evaluate_version_result(success("version one").unwrap());
        assert!(!result.available);
        assert!(!result.supported);
    }

    #[test]
    fn reports_missing_executable_without_exposing_system_details() {
        let result =
            evaluate_version_error(io::Error::new(io::ErrorKind::NotFound, "private path"));
        assert!(!result.available);
        assert!(result
            .message
            .contains("default install location or on PATH"));
    }

    #[test]
    fn prefers_the_documented_default_install_location() {
        let home = tempfile::tempdir().unwrap();
        let bin = home.path().join(".local/bin");
        std::fs::create_dir_all(&bin).unwrap();
        std::fs::write(bin.join(VERSION_EXECUTABLE), "launcher").unwrap();
        assert_eq!(
            resolve_command(home.path(), VERSION_EXECUTABLE),
            bin.join(VERSION_EXECUTABLE)
        );
    }

    #[test]
    fn preflight_uses_dry_run_without_directory_change_flags() {
        let runner = FakeRunner::new(vec![success("jl-mixing 1.2.0\n"), success("preview")]);
        let workspace = Path::new("/fixed/workspace");
        let result = run_client_operation(
            Path::new("/home/tester"),
            workspace,
            request(Some(" The Artist ")),
            ClientOperation::Preflight,
            &runner,
        );

        assert!(result.ok);
        assert_eq!(result.code, ClientOperationCode::Ready);
        let invocations = runner.invocations.borrow();
        assert_eq!(invocations.len(), 2);
        assert_eq!(invocations[1].executable, PathBuf::from("new-client"));
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
        let runner = FakeRunner::new(vec![success("jl-mixing 1.2.0\n"), success("created")]);
        let result = run_client_operation(
            Path::new("/home/tester"),
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
        let runner = FakeRunner::new(vec![success("jl-mixing 2.0.0\n")]);
        let result = run_client_operation(
            Path::new("/home/tester"),
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
        let runner = FakeRunner::new(vec![
            success("jl-mixing 1.2.0\n"),
            failure(4, "Client destination already exists"),
        ]);
        let result = run_client_operation(
            Path::new("/home/tester"),
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
        let runner = FakeRunner::new(vec![
            success("jl-mixing 1.2.0\n"),
            Err(io::Error::new(io::ErrorKind::NotFound, "missing")),
        ]);
        let result = run_client_operation(
            Path::new("/home/tester"),
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
