#![cfg(test)]

use std::cell::RefCell;
use std::collections::VecDeque;
use std::io;
use std::path::{Path, PathBuf};

use crate::automation_api::{ProcessResult, ProcessRunner};
use crate::models::{ApprovalOperationCode, RevisionApprovalRequest};

use super::revision::{run_revision_approval_operation, ApprovalOperation};

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
        let result = self
            .results
            .borrow_mut()
            .pop_front()
            .expect("a fake process result");
        if arguments == ["system-info", "--json"] {
            return match result {
                Ok(output) if output.success => Ok(discovery_output()),
                other => other,
            };
        }
        result
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

fn blocked(code: &str, message: &str) -> io::Result<ProcessResult> {
    Ok(ProcessResult {
        success: false,
        exit_code: Some(5),
        stdout: serde_json::json!({
            "api_version": "1.0",
            "operation": "revision.approve",
            "status": "blocked",
            "data": {},
            "warnings": [],
            "errors": [{
                "code": code,
                "message": message,
                "details": {"exit_code": 5},
                "retryable": false
            }]
        })
        .to_string(),
        stderr: String::new(),
    })
}

fn discovery_output() -> ProcessResult {
    ProcessResult {
        success: true,
        exit_code: Some(0),
        stdout: r#"{"api_version":"1.0","application":{"name":"jl-mixing","version":"9.9.9"},"capabilities":["system.info","revision.create","revision.create.description","revision.approve"]}"#.into(),
        stderr: String::new(),
    }
}

fn installed_home() -> tempfile::TempDir {
    let home = tempfile::tempdir().unwrap();
    let bin = home.path().join(".local/bin");
    std::fs::create_dir_all(&bin).unwrap();
    std::fs::write(bin.join("jl-mixing"), "managed launcher").unwrap();
    home
}

fn approval_request() -> RevisionApprovalRequest {
    RevisionApprovalRequest {
        client_id: "acme-records".into(),
        project_id: "blue-sky".into(),
        revision: 2,
        approved_by: " Client Reviewer ".into(),
    }
}

fn approval_response(status: &str, approved_at: Option<&str>) -> io::Result<ProcessResult> {
    success(
        &serde_json::json!({
            "api_version": "1.0",
            "operation": "revision.approve",
            "status": status,
            "data": {
                "project": {"id": "blue-sky", "path": "/fixed/project"},
                "manifest_path": "/fixed/project/00_Admin/project-manifest.json",
                "workspace_path": "/fixed/workspace",
                "revision": {
                    "number": 2,
                    "path": "/fixed/project/04_Revisions/Revision_02"
                },
                "approved_by": "Client Reviewer",
                "approved_at": approved_at
            },
            "warnings": [],
            "errors": []
        })
        .to_string(),
    )
}

#[test]
fn approval_preflight_uses_structured_api_and_dry_run() {
    let home = installed_home();
    let runner = FakeRunner::new(vec![success("help"), approval_response("planned", None)]);
    let project_directory = Path::new("/fixed/project");

    let result = run_revision_approval_operation(
        home.path(),
        project_directory,
        approval_request(),
        ApprovalOperation::Preflight,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, ApprovalOperationCode::Ready);
    let approval = result.approval.unwrap();
    assert_eq!(approval.revision, 2);
    assert_eq!(approval.approved_by, "Client Reviewer");
    assert_eq!(approval.approved_at, None);
    let invocations = runner.invocations.borrow();
    assert_eq!(invocations[1].executable, home.path().join(".local/bin/jl-mixing"));
    assert_eq!(
        invocations[1].arguments,
        vec![
            "revision",
            "approve",
            "--json",
            "--project",
            "/fixed/project",
            "--revision",
            "2",
            "--approved-by",
            "Client Reviewer",
            "--dry-run"
        ]
    );
    assert_eq!(
        invocations[1].current_directory,
        Some(project_directory.to_owned())
    );
}

#[test]
fn confirmed_approval_uses_provider_timestamp() {
    let home = installed_home();
    let runner = FakeRunner::new(vec![
        success("help"),
        approval_response("success", Some("2026-07-18T13:00:00Z")),
    ]);

    let result = run_revision_approval_operation(
        home.path(),
        Path::new("/fixed/project"),
        approval_request(),
        ApprovalOperation::Approve,
        &runner,
    );

    assert_eq!(result.code, ApprovalOperationCode::Approved);
    assert_eq!(
        result.approval.unwrap().approved_at.as_deref(),
        Some("2026-07-18T13:00:00Z")
    );
}

#[test]
fn successful_approval_with_unverifiable_identity_is_uncertain() {
    let home = installed_home();
    let runner = FakeRunner::new(vec![
        success("help"),
        success(
            r#"{"api_version":"1.0","operation":"revision.approve","status":"success","data":{"project":{"id":"blue-sky","path":"/fixed/project"},"revision":{"number":2,"path":"/fixed/project/04_Revisions/Revision_02"},"approved_by":"Client Reviewer","approved_at":null},"warnings":[],"errors":[]}"#,
        ),
    ]);

    let result = run_revision_approval_operation(
        home.path(),
        Path::new("/fixed/project"),
        approval_request(),
        ApprovalOperation::Approve,
        &runner,
    );

    assert_eq!(result.code, ApprovalOperationCode::Uncertain);
    assert!(result.message.contains("do not retry automatically"));
}

#[test]
fn approval_blocked_response_preserves_provider_message() {
    let home = installed_home();
    let runner = FakeRunner::new(vec![
        success("help"),
        blocked(
            "REVISION_ALREADY_APPROVED",
            "Revision 2 is already the approved revision",
        ),
    ]);

    let result = run_revision_approval_operation(
        home.path(),
        Path::new("/fixed/project"),
        approval_request(),
        ApprovalOperation::Preflight,
        &runner,
    );

    assert_eq!(result.code, ApprovalOperationCode::Rejected);
    assert!(result.message.contains("already the approved revision"));
}
