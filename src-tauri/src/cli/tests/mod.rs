use std::{env, path::PathBuf};

use crate::automation_api::{
    automation_subprocess_path, resolve_command_with_path, AUTOMATION_EXECUTABLE,
};

use std::cell::RefCell;
use std::collections::VecDeque;

use super::*;
use crate::automation_api::ProcessResult;
use crate::models::{
    ClientCreationRequest, ClientOperationCode, ProjectCreationRequest, ProjectCreationSummary,
    ProjectOperationCode, StudioCreationRequest, StudioOperationCode,
};

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

fn failure(code: i32, stderr: &str) -> io::Result<ProcessResult> {
    Ok(ProcessResult {
        success: false,
        exit_code: Some(code),
        stdout: String::new(),
        stderr: stderr.into(),
    })
}

#[test]
fn automation_subprocess_path_preserves_inherited_path_and_adds_homebrew() {
    let inherited = env::join_paths(["/custom/bin", "/usr/bin"]).unwrap();
    let augmented = automation_subprocess_path(Some(&inherited)).unwrap();
    let paths: Vec<_> = env::split_paths(&augmented).collect();

    assert_eq!(
        paths,
        vec![
            PathBuf::from("/custom/bin"),
            PathBuf::from("/usr/bin"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/opt/homebrew/bin"),
        ]
    );
}

#[test]
fn automation_subprocess_path_does_not_duplicate_homebrew_paths() {
    let inherited = env::join_paths(["/opt/homebrew/bin", "/usr/local/bin"]).unwrap();
    let augmented = automation_subprocess_path(Some(&inherited)).unwrap();
    let paths: Vec<_> = env::split_paths(&augmented).collect();

    assert_eq!(
        paths,
        vec![
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/usr/local/bin"),
        ]
    );
}

fn request(artist: Option<&str>) -> ClientCreationRequest {
    ClientCreationRequest {
        client_id: "acme-records".into(),
        client_name: " Acme Records ".into(),
        default_artist: artist.map(str::to_owned),
    }
}

fn client_api_response(status: &str) -> io::Result<ProcessResult> {
    success(&format!(
        r#"{{"api_version":"1.0","operation":"client.create","status":"{}","data":{{"client":{{"id":"acme-records","path":"/fixed/workspace/Clients/Acme Records"}},"configuration_path":"/fixed/workspace/Clients/Acme Records/client.json","workspace_path":"/fixed/workspace"}},"warnings":[],"errors":[]}}"#,
        status
    ))
}

fn client_api_error(code: &str, message: &str) -> io::Result<ProcessResult> {
    Ok(ProcessResult {
        success: false,
        exit_code: Some(5),
        stdout: format!(
            r#"{{"api_version":"1.0","operation":"client.create","status":"blocked","data":{{}},"warnings":[],"errors":[{{"code":"{}","message":"{}","details":{{"exit_code":5}},"retryable":false}}]}}"#,
            code, message
        ),
        stderr: String::new(),
    })
}

fn studio_request() -> StudioCreationRequest {
    StudioCreationRequest {
        studio_name: " New Studio ".into(),
        mix_engineer: Some(" Engineer ".into()),
        sample_rate: 48_000,
        bit_depth: 24,
        file_format: "wav".into(),
    }
}

fn project_request(artist: Option<&str>) -> ProjectCreationRequest {
    ProjectCreationRequest {
        client_id: "acme-records".into(),
        project_name: " Blue Sky ".into(),
        artist: artist.map(str::to_owned),
    }
}

fn project_api_response(status: &str, artist: &str) -> io::Result<ProcessResult> {
    success(&format!(
        r#"{{"api_version":"1.0","operation":"project.create","status":"{}","data":{{"project":{{"id":"blue-sky","name":"Blue Sky","artist":"{}","path":"/fixed/client/Projects/Blue Sky"}},"client":{{"id":"acme-records","path":"/fixed/client"}},"workspace_path":"/fixed/workspace"}},"warnings":[],"errors":[]}}"#,
        status, artist
    ))
}

fn project_api_error(code: &str, message: &str) -> io::Result<ProcessResult> {
    Ok(ProcessResult {
        success: false,
        exit_code: Some(5),
        stdout: format!(
            r#"{{"api_version":"1.0","operation":"project.create","status":"blocked","data":{{}},"warnings":[],"errors":[{{"code":"{}","message":"{}","details":{{"exit_code":5}},"retryable":false}}]}}"#,
            code, message
        ),
        stderr: String::new(),
    })
}

fn revision_api_response(status: &str, description: &str) -> io::Result<ProcessResult> {
    success(&format!(
        r#"{{"api_version":"1.0","operation":"revision.create","status":"{}","data":{{"project":{{"id":"blue-sky","path":"/fixed/project"}},"revision":{{"number":3,"description":"{}","path":"/fixed/project/04_Revisions/Revision_03"}},"revision_notes_path":"/fixed/project/04_Revisions/Revision_03/Revision_Notes.md","workspace_path":"/fixed/workspace"}},"warnings":[],"errors":[]}}"#,
        status, description
    ))
}

fn revision_api_error(code: &str, message: &str) -> io::Result<ProcessResult> {
    Ok(ProcessResult {
        success: false,
        exit_code: Some(5),
        stdout: format!(
            r#"{{"api_version":"1.0","operation":"revision.create","status":"blocked","data":{{}},"warnings":[],"errors":[{{"code":"{}","message":"{}","details":{{"exit_code":5}},"retryable":false}}]}}"#,
            code, message
        ),
        stderr: String::new(),
    })
}

fn intake_api_response(status: &str, blocking: bool) -> io::Result<ProcessResult> {
    let report = intake_report(blocking);
    let errors = if blocking {
        serde_json::json!([{
            "code": "INTAKE_BLOCKING_FINDINGS",
            "message": "Intake validation completed with blocking findings.",
            "details": {"exit_code": 5, "blocking_errors": 1},
            "retryable": false
        }])
    } else {
        serde_json::json!([])
    };
    success(
        &serde_json::json!({
            "api_version": "1.0",
            "operation": "intake.validate",
            "status": status,
            "data": {
                "project": {"id": "blue-sky", "path": "/fixed/project"},
                "manifest_path": "/fixed/project/00_Admin/project-manifest.json",
                "intake_report_path": "/fixed/project/00_Admin/Intake_Report.md",
                "workspace_path": "/fixed/workspace",
                "source_path": "/fixed/project/01_Client_Files/Original_Delivery",
                "report_markdown": report,
                "summary": {
                    "files_discovered": 1,
                    "blocking_errors": usize::from(blocking),
                    "warnings": 0,
                    "ffprobe_available": false
                }
            },
            "warnings": [],
            "errors": errors
        })
        .to_string(),
    )
}

fn intake_request() -> IntakeRequest {
    IntakeRequest {
        client_id: "acme-records".into(),
        project_id: "blue-sky".into(),
    }
}

fn revision_request(description: Option<&str>) -> RevisionCreationRequest {
    RevisionCreationRequest {
        client_id: "acme-records".into(),
        project_id: "blue-sky".into(),
        description: description.map(str::to_owned),
    }
}

fn approval_request(revision: u32, approved_by: &str) -> RevisionApprovalRequest {
    RevisionApprovalRequest {
        client_id: "acme-records".into(),
        project_id: "blue-sky".into(),
        revision,
        approved_by: approved_by.into(),
    }
}

fn approval_output(preflight: bool, revision: u32, approved_by: &str) -> String {
    if preflight {
        format!(
            "Dry run — no changes made.\n\nProject: Blue Sky\nCurrent revision: 3\nSelected revision: {revision}\nCurrent approved revision: 1\nApprover: {approved_by}\nApproval timestamp: current time at execution\n"
        )
    } else {
        format!(
            "Revision approved successfully.\n\nProject: Blue Sky\nApproved revision: {revision}\nApproved by: {approved_by}\nApproved at: 2026-07-18T13:00:00Z\nProject state: approved\n"
        )
    }
}

fn delivery_request() -> DeliveryCreationRequest {
    DeliveryCreationRequest {
        client_id: "acme-records".into(),
        project_id: "blue-sky".into(),
        replacement_mode: crate::models::DeliveryReplacementMode::Default,
        create_zip: false,
        confirmed_deletions: Vec::new(),
    }
}

fn delivery_output(preflight: bool) -> String {
    let heading = if preflight {
        "Dry run — no changes made."
    } else {
        "Final delivery created successfully."
    };
    let delivered = if preflight { "null" } else { "1" };
    format!(
        "{heading}\n\nProject:             Blue Sky\nCurrent revision:    2\nApproved revision:   1\nDelivered revision:  {delivered}\nDelivery method:     Download\nReplacement mode:    default\nCreate ZIP:          no\n\nSelected files:\n  Blue Sky Main Mix.wav\n    Type: main_mix\n    Destination: Blue Sky Main Mix.wav\n  Blue Sky Stems.wav\n    Type: stems\n    Destination: Stems/Blue Sky Stems.wav\n\nExcluded:\n  Revision_Notes.md    revision notes\n\nWould create:\n  Blue Sky Main Mix.wav\n  Stems/Blue Sky Stems.wav\n  Delivery_Notes.md\n  delivery-manifest.json\n"
    )
}

fn intake_report(blocking: bool) -> String {
    let error_count = usize::from(blocking);
    let errors = if blocking {
        "- Unreadable audio file `broken.wav`: invalid data"
    } else {
        "- None."
    };
    format!(
        r#"## Intake Summary

- Source: `/fixed/project/01_Client_Files/Original_Delivery`
- Files discovered: 1
- Blocking errors: {error_count}
- Warnings: 0
- Expected sample rate: 48000
- Expected bit depth: 24
- Enhanced inspection: unavailable

## Critical Errors

{errors}

## Duplicate Filenames

- None.

## Project-Format Mismatches

- None.

## Unsupported or Non-Audio Files

- None.

## Skipped or Unavailable Checks

- ffprobe is not installed; enhanced audio inspection was unavailable.

## Source Inventory

| File | Size (bytes) | Technical details |
|---|---:|---|
| `song.wav` | 12 | not inspected |

## Preparation Recommendations

- Review the intake report.
"#
    )
}

fn installed_home(_version: &str) -> tempfile::TempDir {
    let home = tempfile::tempdir().unwrap();
    let bin = home.path().join(".local/bin");
    std::fs::create_dir_all(&bin).unwrap();
    for executable in [
        "jl-mixing",
        STUDIO_EXECUTABLE,
        DELIVERY_EXECUTABLE,
        APPROVAL_EXECUTABLE,
    ] {
        std::fs::write(bin.join(executable), "managed launcher").unwrap();
    }
    home
}

fn discovery_output() -> ProcessResult {
    ProcessResult {
        success: true,
        exit_code: Some(0),
        stdout: r#"{"api_version":"1.0","application":{"name":"jl-mixing","version":"9.9.9"},"capabilities":["system.info","client.create","project.create","project.create.artist","revision.create","revision.create.description","intake.validate","intake.validate.report","revision.approve","delivery.create"]}"#.into(),
        stderr: String::new(),
    }
}

#[path = "approval_test.rs"]
mod approval;
#[path = "client_test.rs"]
mod client;
#[path = "delivery_test.rs"]
mod delivery;
#[path = "intake_test.rs"]
mod intake;
#[path = "project_test.rs"]
mod project;
#[path = "revision_test.rs"]
mod revision;
#[path = "studio_test.rs"]
mod studio;

#[test]
fn bounds_process_error_output() {
    let message = "x".repeat(MAX_PROCESS_MESSAGE_CHARS + 20);
    let result = bounded_process_message(&message, "", "fallback");
    assert_eq!(result.chars().count(), MAX_PROCESS_MESSAGE_CHARS);
}
