#![cfg(test)]

use std::cell::RefCell;
use std::collections::VecDeque;
use std::io;
use std::path::{Path, PathBuf};

use crate::automation_api::{
    check_automation_compatibility, invoke_api, ApiCallError, ApiStatus, ProcessResult,
    ProcessRunner, AUTOMATION_EXECUTABLE,
};

struct FakeRunner {
    results: RefCell<VecDeque<io::Result<ProcessResult>>>,
    invocations: RefCell<Vec<Invocation>>,
}

#[derive(Debug, PartialEq, Eq)]
struct Invocation {
    executable: PathBuf,
    arguments: Vec<String>,
    current_directory: Option<PathBuf>,
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
            .expect("expected fake process result")
    }
}

fn installed_home() -> tempfile::TempDir {
    let home = tempfile::tempdir().expect("temporary home");
    let bin = home.path().join(".local/bin");
    std::fs::create_dir_all(&bin).expect("create bin");
    std::fs::write(bin.join(AUTOMATION_EXECUTABLE), "managed launcher")
        .expect("create executable stub");
    home
}

fn process(success: bool, exit_code: Option<i32>, stdout: &str) -> io::Result<ProcessResult> {
    Ok(ProcessResult {
        success,
        exit_code,
        stdout: stdout.to_owned(),
        stderr: String::new(),
    })
}

fn success(stdout: &str) -> io::Result<ProcessResult> {
    process(true, Some(0), stdout)
}

fn discovery(api_version: Option<&str>, application: Option<&str>, capabilities: Option<&str>) -> String {
    format!(
        "{{{}{}{} }}",
        api_version
            .map(|value| format!("\"api_version\":\"{value}\","))
            .unwrap_or_default(),
        application
            .map(|value| format!("\"application\":{value},"))
            .unwrap_or_default(),
        capabilities
            .map(|value| format!("\"capabilities\":{value}"))
            .unwrap_or_default()
    )
}

#[test]
fn discovery_without_api_version_is_unavailable() {
    let home = installed_home();
    let document = discovery(
        None,
        Some(r#"{"name":"jl-mixing","version":"1.3.1"}"#),
        Some(r#"["system.info"]"#),
    );
    let result = check_automation_compatibility(home.path(), &FakeRunner::new(vec![success(&document)]));

    assert!(!result.available);
    assert!(!result.supported);
    assert!(result.message.contains("did not declare an Automation API version"));
}

#[test]
fn discovery_without_provider_identity_is_unavailable() {
    let home = installed_home();
    let document = discovery(Some("1.0"), None, Some(r#"["system.info"]"#));
    let result = check_automation_compatibility(home.path(), &FakeRunner::new(vec![success(&document)]));

    assert!(!result.available);
    assert!(result.message.contains("did not identify the provider application"));
}

#[test]
fn discovery_with_wrong_provider_identity_is_unavailable() {
    let home = installed_home();
    let document = discovery(
        Some("1.0"),
        Some(r#"{"name":"other-tool","version":"1.3.1"}"#),
        Some(r#"["system.info"]"#),
    );
    let result = check_automation_compatibility(home.path(), &FakeRunner::new(vec![success(&document)]));

    assert!(!result.available);
    assert!(result.message.contains("valid provider application"));
}

#[test]
fn discovery_without_capabilities_is_unavailable() {
    let home = installed_home();
    let document = discovery(
        Some("1.0"),
        Some(r#"{"name":"jl-mixing","version":"1.3.1"}"#),
        None,
    );
    let result = check_automation_compatibility(home.path(), &FakeRunner::new(vec![success(&document)]));

    assert!(!result.available);
    assert!(result.message.contains("did not declare provider capabilities"));
}

#[test]
fn discovery_command_failure_has_stable_unavailable_mapping() {
    let home = installed_home();
    let result = check_automation_compatibility(
        home.path(),
        &FakeRunner::new(vec![process(false, Some(7), "")]),
    );

    assert!(!result.available);
    assert!(!result.supported);
    assert!(result.message.contains("exit code 7"));
}

#[test]
fn discovery_start_failure_has_stable_unavailable_mapping() {
    let home = installed_home();
    let result = check_automation_compatibility(
        home.path(),
        &FakeRunner::new(vec![Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "blocked",
        ))]),
    );

    assert!(!result.available);
    assert!(result.message.contains("could not be started"));
}

#[test]
fn invocation_accepts_supported_api_contract() {
    let home = installed_home();
    let runner = FakeRunner::new(vec![success(
        r#"{"api_version":"1.0","operation":"client.create","status":"planned","data":{},"warnings":[],"errors":[]}"#,
    )]);
    let arguments = vec!["client".into(), "create".into(), "--json".into()];

    let response = invoke_api(home.path(), "client.create", &arguments, None, &runner)
        .expect("supported API response");

    assert_eq!(response.status, ApiStatus::Planned);
    assert_eq!(runner.invocations.borrow()[0].arguments, arguments);
}

#[test]
fn invocation_rejects_malformed_response() {
    let home = installed_home();
    let result = invoke_api(
        home.path(),
        "client.create",
        &["client".into(), "create".into(), "--json".into()],
        None,
        &FakeRunner::new(vec![success("not-json")]),
    );

    assert_eq!(result.expect_err("malformed response"), ApiCallError::Malformed);
}

#[test]
fn invocation_rejects_incompatible_api_version() {
    let home = installed_home();
    let result = invoke_api(
        home.path(),
        "client.create",
        &["client".into(), "create".into(), "--json".into()],
        None,
        &FakeRunner::new(vec![success(
            r#"{"api_version":"2.0","operation":"client.create","status":"planned","data":{},"warnings":[],"errors":[]}"#,
        )]),
    );

    assert_eq!(
        result.expect_err("incompatible API"),
        ApiCallError::IncompatibleVersion("2.0".into())
    );
}

#[test]
fn invocation_rejects_unexpected_operation() {
    let home = installed_home();
    let result = invoke_api(
        home.path(),
        "client.create",
        &["client".into(), "create".into(), "--json".into()],
        None,
        &FakeRunner::new(vec![success(
            r#"{"api_version":"1.0","operation":"project.create","status":"planned","data":{},"warnings":[],"errors":[]}"#,
        )]),
    );

    assert_eq!(
        result.expect_err("unexpected operation"),
        ApiCallError::UnexpectedOperation("project.create".into())
    );
}

#[test]
fn invocation_maps_missing_process_to_unavailable() {
    let home = installed_home();
    let result = invoke_api(
        home.path(),
        "client.create",
        &["client".into(), "create".into(), "--json".into()],
        None,
        &FakeRunner::new(vec![Err(io::Error::new(io::ErrorKind::NotFound, "gone"))]),
    );

    assert_eq!(result.expect_err("missing process"), ApiCallError::Unavailable);
}

#[test]
fn invocation_maps_other_start_errors_to_start_failed() {
    let home = installed_home();
    let result = invoke_api(
        home.path(),
        "client.create",
        &["client".into(), "create".into(), "--json".into()],
        None,
        &FakeRunner::new(vec![Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "blocked",
        ))]),
    );

    assert_eq!(result.expect_err("start failure"), ApiCallError::StartFailed);
}
