#![cfg(test)]

use std::cell::RefCell;
use std::collections::VecDeque;
use std::io;
use std::path::{Path, PathBuf};

use crate::automation_api::{ProcessResult, ProcessRunner};
use crate::models::{
    DeliveryCreationRequest, DeliveryOperationCode, DeliveryReplacementMode,
};

use super::delivery::{run_delivery_operation, DeliveryOperation};

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

fn blocked(message: &str) -> io::Result<ProcessResult> {
    Ok(ProcessResult {
        success: false,
        exit_code: Some(5),
        stdout: serde_json::json!({
            "api_version": "1.0",
            "operation": "delivery.create",
            "status": "blocked",
            "data": {},
            "warnings": [],
            "errors": [{
                "code": "DELIVERY_REPLACEMENT_REQUIRED",
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
        stdout: r#"{"api_version":"1.0","application":{"name":"jl-mixing","version":"9.9.9"},"capabilities":["system.info","delivery.create"]}"#.into(),
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

fn request(mode: DeliveryReplacementMode) -> DeliveryCreationRequest {
    DeliveryCreationRequest {
        client_id: "acme-records".into(),
        project_id: "blue-sky".into(),
        replacement_mode: mode,
        create_zip: false,
        confirmed_deletions: Vec::new(),
    }
}

fn response(status: &str, mode: &str, delivered_revision: Option<u32>, deletions: &[&str]) -> io::Result<ProcessResult> {
    success(
        &serde_json::json!({
            "api_version": "1.0",
            "operation": "delivery.create",
            "status": status,
            "data": {
                "project": {
                    "id": "blue-sky",
                    "name": "Blue Sky",
                    "path": "/fixed/project"
                },
                "manifest_path": "/fixed/project/00_Admin/project-manifest.json",
                "delivery_path": "/fixed/project/05_Final_Delivery",
                "delivery_notes_path": "/fixed/project/05_Final_Delivery/Delivery_Notes.md",
                "delivery_manifest_path": "/fixed/project/05_Final_Delivery/delivery-manifest.json",
                "revision": {
                    "number": 1,
                    "path": "/fixed/project/04_Revisions/Revision_01"
                },
                "current_revision": 1,
                "approved_revision": 1,
                "delivered_revision": delivered_revision,
                "delivery_method": "Cloud transfer",
                "workspace_path": "/fixed/workspace",
                "replacement_mode": mode,
                "zip_requested": false,
                "zip_name": null,
                "files_delivered": if status == "success" { 2 } else { 0 },
                "selected": [
                    {
                        "source_name": "Blue Sky Main Mix.wav",
                        "deliverable_type": "main_mix",
                        "path": "Blue Sky Main Mix.wav"
                    },
                    {
                        "source_name": "Blue Sky Stems.wav",
                        "deliverable_type": "stems",
                        "path": "Stems/Blue Sky Stems.wav"
                    }
                ],
                "excluded": [{"name": "Revision_Notes.md", "reason": "revision notes"}],
                "deletions": deletions
            },
            "warnings": [],
            "errors": []
        })
        .to_string(),
    )
}

#[test]
fn delivery_preflight_uses_structured_api_and_preserves_plan() {
    let home = installed_home();
    let runner = FakeRunner::new(vec![success("help"), response("planned", "default", None, &[])]);
    let project_directory = Path::new("/fixed/project");

    let result = run_delivery_operation(
        home.path(),
        project_directory,
        request(DeliveryReplacementMode::Default),
        DeliveryOperation::Preflight,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, DeliveryOperationCode::Ready);
    let delivery = result.delivery.unwrap();
    assert_eq!(delivery.project_name, "Blue Sky");
    assert_eq!(delivery.delivery_method, "Cloud transfer");
    assert_eq!(delivery.selected.len(), 2);
    assert_eq!(delivery.excluded[0].reason, "revision notes");
    let invocations = runner.invocations.borrow();
    assert_eq!(invocations[1].executable, home.path().join(".local/bin/jl-mixing"));
    assert_eq!(
        invocations[1].arguments,
        vec![
            "delivery",
            "create",
            "--json",
            "--project",
            "/fixed/project",
            "--dry-run"
        ]
    );
    assert_eq!(invocations[1].current_directory, Some(project_directory.to_owned()));
}

#[test]
fn confirmed_clean_revalidates_exact_inventory_before_execution() {
    let home = installed_home();
    let runner = FakeRunner::new(vec![
        success("help"),
        response(
            "planned",
            "clean",
            None,
            &["Delivery_Notes.md", "stale.txt"],
        ),
        response(
            "success",
            "clean",
            Some(1),
            &["Delivery_Notes.md", "stale.txt"],
        ),
    ]);
    let mut request = request(DeliveryReplacementMode::Clean);
    request.confirmed_deletions = vec!["Delivery_Notes.md".into(), "stale.txt".into()];

    let result = run_delivery_operation(
        home.path(),
        Path::new("/fixed/project"),
        request,
        DeliveryOperation::Create,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, DeliveryOperationCode::Created);
    let invocations = runner.invocations.borrow();
    assert_eq!(invocations.len(), 3);
    assert!(invocations[1].arguments.ends_with(&["--clean".into(), "--dry-run".into()]));
    assert!(invocations[2].arguments.ends_with(&["--clean".into()]));
}

#[test]
fn changed_clean_inventory_is_rejected_before_destructive_execution() {
    let home = installed_home();
    let runner = FakeRunner::new(vec![
        success("help"),
        response(
            "planned",
            "clean",
            None,
            &["Delivery_Notes.md", "new-stale.txt"],
        ),
    ]);
    let mut request = request(DeliveryReplacementMode::Clean);
    request.confirmed_deletions = vec!["Delivery_Notes.md".into(), "stale.txt".into()];

    let result = run_delivery_operation(
        home.path(),
        Path::new("/fixed/project"),
        request,
        DeliveryOperation::Create,
        &runner,
    );

    assert!(!result.ok);
    assert_eq!(result.code, DeliveryOperationCode::Rejected);
    assert!(result.message.contains("inventory changed"));
    assert_eq!(runner.invocations.borrow().len(), 2);
}

#[test]
fn successful_delivery_with_unverifiable_identity_is_uncertain() {
    let home = installed_home();
    let bad = success(
        r#"{"api_version":"1.0","operation":"delivery.create","status":"success","data":{"project":{"id":"wrong-project","name":"Blue Sky","path":"/fixed/project"},"revision":{"number":1,"path":"/fixed/project/04_Revisions/Revision_01"},"current_revision":1,"approved_revision":1,"delivered_revision":1,"delivery_method":"Cloud transfer","replacement_mode":"default","zip_requested":false,"zip_name":null,"selected":[{"source_name":"Blue Sky Main Mix.wav","deliverable_type":"main_mix","path":"Blue Sky Main Mix.wav"}],"excluded":[],"deletions":[]},"warnings":[],"errors":[]}"#,
    );
    let runner = FakeRunner::new(vec![success("help"), bad]);

    let result = run_delivery_operation(
        home.path(),
        Path::new("/fixed/project"),
        request(DeliveryReplacementMode::Default),
        DeliveryOperation::Create,
        &runner,
    );

    assert_eq!(result.code, DeliveryOperationCode::Uncertain);
    assert!(result.message.contains("do not retry automatically"));
}

#[test]
fn delivery_rejection_preserves_structured_provider_message() {
    let home = installed_home();
    let runner = FakeRunner::new(vec![
        success("help"),
        blocked("Existing delivery requires explicit replacement mode"),
    ]);

    let result = run_delivery_operation(
        home.path(),
        Path::new("/fixed/project"),
        request(DeliveryReplacementMode::Default),
        DeliveryOperation::Preflight,
        &runner,
    );

    assert_eq!(result.code, DeliveryOperationCode::Rejected);
    assert!(result.message.contains("explicit replacement mode"));
}
