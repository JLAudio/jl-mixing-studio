use std::{env, path::PathBuf};

use crate::automation_api::{
    automation_subprocess_path, resolve_command_with_path, AUTOMATION_EXECUTABLE,
};

use std::cell::RefCell;
use std::collections::VecDeque;

use super::*;
use crate::automation_api::ProcessResult;
use crate::models::{
    ClientCreationRequest, ClientOperationCode, StudioCreationRequest, StudioOperationCode,
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

#[test]
fn studio_preflight_uses_fixed_default_workspace_arguments() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![success("help"), success("ready")]);
    let result = run_studio_operation(
        home.path(),
        studio_request(),
        StudioOperation::Preflight,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, StudioOperationCode::Ready);
    assert_eq!(result.studio.unwrap().studio_name, "New Studio");
    let invocation = &runner.invocations.borrow()[1];
    assert_eq!(
        invocation.executable,
        home.path().join(".local/bin/new-studio")
    );
    assert_eq!(invocation.current_directory, Some(home.path().into()));
    assert_eq!(
        invocation.arguments,
        vec![
            "--name",
            "New Studio",
            "--engineer",
            "Engineer",
            "--sample-rate",
            "48000",
            "--bit-depth",
            "24",
            "--file-format",
            "WAV",
            "--dry-run",
        ]
    );
}

#[test]
fn confirmed_studio_creation_disables_directory_changes() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![success("help"), success("created")]);
    let result = run_studio_operation(
        home.path(),
        studio_request(),
        StudioOperation::Create,
        &runner,
    );

    assert_eq!(result.code, StudioOperationCode::Created);
    assert_eq!(
        runner.invocations.borrow()[1].arguments.last().unwrap(),
        "--no-default-cd"
    );
}

#[test]
fn invalid_studio_request_never_starts_a_process() {
    let runner = FakeRunner::new(Vec::new());
    let mut invalid = studio_request();
    invalid.sample_rate = 12_345;
    let result = run_studio_operation(
        Path::new("/home/tester"),
        invalid,
        StudioOperation::Preflight,
        &runner,
    );
    assert_eq!(result.code, StudioOperationCode::InvalidInput);
    assert!(runner.invocations.borrow().is_empty());
}

#[test]
fn prefers_the_documented_default_install_location() {
    let home = installed_home("1.3.1");
    assert_eq!(
        resolve_command_with_path(home.path(), AUTOMATION_EXECUTABLE, None),
        Some(home.path().join(".local/bin").join(AUTOMATION_EXECUTABLE))
    );
}

#[test]
fn resolves_a_documented_custom_prefix_from_path() {
    let home = tempfile::tempdir().unwrap();
    let prefix = tempfile::tempdir().unwrap();
    let bin = prefix.path().join("bin");
    std::fs::create_dir_all(&bin).unwrap();
    std::fs::write(bin.join(AUTOMATION_EXECUTABLE), "managed launcher").unwrap();
    let search_path = env::join_paths([&bin]).unwrap();

    let executable = resolve_command_with_path(
        home.path(),
        AUTOMATION_EXECUTABLE,
        Some(search_path.as_os_str()),
    )
    .unwrap();
    assert_eq!(executable, bin.join(AUTOMATION_EXECUTABLE));
}

#[test]
fn preflight_uses_dry_run_without_directory_change_flags() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![success("help"), client_api_response("planned")]);
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
        home.path().join(".local/bin/jl-mixing")
    );
    assert_eq!(
        invocations[1].arguments,
        vec![
            "client",
            "create",
            "acme-records",
            "--json",
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
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![success("help"), client_api_response("success")]);
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
        vec![
            "client",
            "create",
            "acme-records",
            "--json",
            "--name",
            "Acme Records"
        ]
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
fn reports_collision_from_rejected_dry_run() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        client_api_error("CLIENT_ALREADY_EXISTS", "Client destination already exists"),
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
fn reports_missing_api_provider_separately() {
    let home = installed_home("1.3.1");
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
    assert!(result.message.contains("JL Mixing Automation"));
}

#[test]
fn project_preflight_uses_fixed_arguments_and_validated_client_directory() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        project_api_response("planned", "The Artist"),
    ]);
    let client_directory = Path::new("/fixed/workspace/Clients/Acme Records");
    let result = run_project_operation(
        home.path(),
        client_directory,
        project_request(Some(" The Artist ")),
        ProjectOperation::Preflight,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, ProjectOperationCode::Ready);
    assert_eq!(
        result.project,
        Some(ProjectCreationSummary {
            client_id: "acme-records".into(),
            project_id: "blue-sky".into(),
            project_name: "Blue Sky".into(),
            artist: "The Artist".into(),
        })
    );
    let invocations = runner.invocations.borrow();
    assert_eq!(invocations.len(), 2);
    assert_eq!(
        invocations[1].executable,
        home.path().join(".local/bin/jl-mixing")
    );
    assert_eq!(
        invocations[1].arguments,
        vec![
            "project",
            "create",
            "Blue Sky",
            "--json",
            "--artist",
            "The Artist",
            "--dry-run"
        ]
    );
    assert!(!invocations[1].arguments.contains(&"--no-cd".into()));
    assert_eq!(
        invocations[1].current_directory,
        Some(client_directory.to_owned())
    );
}

#[test]
fn confirmed_project_creation_uses_no_cd_and_inherits_artist() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        project_api_response("success", "Inherited Artist"),
    ]);
    let result = run_project_operation(
        home.path(),
        Path::new("/fixed/client"),
        project_request(Some("   ")),
        ProjectOperation::Create,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, ProjectOperationCode::Created);
    assert_eq!(
        runner.invocations.borrow()[1].arguments,
        vec!["project", "create", "Blue Sky", "--json"]
    );
    assert_eq!(result.project.unwrap().artist, "Inherited Artist");
}

#[test]
fn invalid_project_input_never_starts_a_process() {
    let runner = FakeRunner::new(Vec::new());
    let mut invalid = project_request(None);
    invalid.project_name = "   ".into();
    let result = run_project_operation(
        Path::new("/home/tester"),
        Path::new("/fixed/client"),
        invalid,
        ProjectOperation::Preflight,
        &runner,
    );

    assert_eq!(result.code, ProjectOperationCode::InvalidInput);
    assert!(runner.invocations.borrow().is_empty());
}

#[test]
fn project_collision_is_reported_from_preflight() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        project_api_error(
            "PROJECT_ALREADY_EXISTS",
            "Project destination already exists",
        ),
    ]);
    let result = run_project_operation(
        home.path(),
        Path::new("/fixed/client"),
        project_request(None),
        ProjectOperation::Preflight,
        &runner,
    );

    assert_eq!(result.code, ProjectOperationCode::Collision);
    assert!(result.message.contains("already exists"));
}

#[test]
fn successful_creation_without_identity_is_uncertain() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        success(
            r#"{"api_version":"1.0","operation":"project.create","status":"success","data":{"project":{"id":"blue-sky","name":"Blue Sky","path":"/fixed/client/Projects/Blue Sky"},"client":{"id":"acme-records","path":"/fixed/client"}},"warnings":[],"errors":[]}"#,
        ),
    ]);
    let result = run_project_operation(
        home.path(),
        Path::new("/fixed/client"),
        project_request(None),
        ProjectOperation::Create,
        &runner,
    );

    assert_eq!(result.code, ProjectOperationCode::Uncertain);
    assert!(result.message.contains("may have completed"));
}

#[test]
fn revision_preflight_uses_description_and_dry_run_from_validated_project() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        revision_api_response("planned", "Vocal lift"),
    ]);
    let project_directory = Path::new("/fixed/project");
    let result = run_revision_operation(
        home.path(),
        project_directory,
        revision_request(Some(" Vocal lift ")),
        RevisionOperation::Preflight,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, RevisionOperationCode::Ready);
    assert_eq!(result.revision.unwrap().number, 3);
    let invocations = runner.invocations.borrow();
    assert_eq!(
        invocations[1].executable,
        home.path().join(".local/bin/jl-mixing")
    );
    assert_eq!(
        invocations[1].arguments,
        vec![
            "revision",
            "create",
            "--json",
            "--project",
            "/fixed/project",
            "--description",
            "Vocal lift",
            "--dry-run"
        ]
    );
    assert_eq!(
        invocations[1].current_directory,
        Some(project_directory.to_owned())
    );
}

#[test]
fn confirmed_revision_creation_uses_no_cd_and_automation_default_description() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        revision_api_response("success", "Revision 3"),
    ]);
    let result = run_revision_operation(
        home.path(),
        Path::new("/fixed/project"),
        revision_request(Some("   ")),
        RevisionOperation::Create,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, RevisionOperationCode::Created);
    assert_eq!(
        runner.invocations.borrow()[1].arguments,
        vec![
            "revision",
            "create",
            "--json",
            "--project",
            "/fixed/project"
        ]
    );
    assert_eq!(result.revision.unwrap().description, "Revision 3");
}

#[test]
fn invalid_revision_input_never_starts_a_process() {
    let runner = FakeRunner::new(Vec::new());
    let result = run_revision_operation(
        Path::new("/home/tester"),
        Path::new("/fixed/project"),
        revision_request(Some("unsafe\nvalue")),
        RevisionOperation::Preflight,
        &runner,
    );

    assert_eq!(result.code, RevisionOperationCode::InvalidInput);
    assert!(runner.invocations.borrow().is_empty());
}

#[test]
fn successful_revision_creation_without_identity_is_uncertain() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        success(
            r#"{"api_version":"1.0","operation":"revision.create","status":"success","data":{"project":{"id":"blue-sky","path":"/fixed/project"},"revision":{"number":3,"path":"/fixed/project/04_Revisions/Revision_03"}},"warnings":[],"errors":[]}"#,
        ),
    ]);
    let result = run_revision_operation(
        home.path(),
        Path::new("/fixed/project"),
        revision_request(None),
        RevisionOperation::Create,
        &runner,
    );

    assert_eq!(result.code, RevisionOperationCode::Uncertain);
    assert!(result.message.contains("do not retry automatically"));
}

#[test]
fn revision_rejection_preserves_the_bounded_automation_message() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        revision_api_error(
            "REVISION_ALREADY_EXISTS",
            "Revision destination already exists",
        ),
    ]);
    let result = run_revision_operation(
        home.path(),
        Path::new("/fixed/project"),
        revision_request(None),
        RevisionOperation::Preflight,
        &runner,
    );

    assert_eq!(result.code, RevisionOperationCode::Rejected);
    assert!(result.message.contains("already exists"));
}

#[test]
fn approval_preflight_uses_only_selected_revision_approver_and_dry_run() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        success(&approval_output(true, 2, "Client Reviewer")),
    ]);
    let project_directory = Path::new("/fixed/project");
    let result = run_approval_operation(
        home.path(),
        project_directory,
        approval_request(2, " Client Reviewer "),
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
    assert_eq!(
        invocations[1].executable,
        home.path().join(".local/bin/approve-mix")
    );
    assert_eq!(
        invocations[1].arguments,
        vec![
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
fn confirmed_approval_parses_automation_timestamp_without_date_override() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        success(&approval_output(false, 2, "Client")),
    ]);
    let result = run_approval_operation(
        home.path(),
        Path::new("/fixed/project"),
        approval_request(2, "Client"),
        ApprovalOperation::Approve,
        &runner,
    );

    assert_eq!(result.code, ApprovalOperationCode::Approved);
    assert_eq!(
        runner.invocations.borrow()[1].arguments,
        vec!["--revision", "2", "--approved-by", "Client"]
    );
    assert_eq!(
        result.approval.unwrap().approved_at.as_deref(),
        Some("2026-07-18T13:00:00Z")
    );
}

#[test]
fn invalid_approval_input_never_starts_a_process() {
    let runner = FakeRunner::new(Vec::new());
    let result = run_approval_operation(
        Path::new("/home/tester"),
        Path::new("/fixed/project"),
        approval_request(0, "Client"),
        ApprovalOperation::Preflight,
        &runner,
    );

    assert_eq!(result.code, ApprovalOperationCode::InvalidInput);
    assert!(runner.invocations.borrow().is_empty());
}

#[test]
fn successful_approval_without_identity_is_uncertain() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![success("help"), success("Revision approved")]);
    let result = run_approval_operation(
        home.path(),
        Path::new("/fixed/project"),
        approval_request(2, "Client"),
        ApprovalOperation::Approve,
        &runner,
    );

    assert_eq!(result.code, ApprovalOperationCode::Uncertain);
    assert!(result.message.contains("do not retry automatically"));
}

#[test]
fn approval_rejection_preserves_the_bounded_automation_message() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        failure(5, "Revision 2 is already the approved revision"),
    ]);
    let result = run_approval_operation(
        home.path(),
        Path::new("/fixed/project"),
        approval_request(2, "Client"),
        ApprovalOperation::Preflight,
        &runner,
    );

    assert_eq!(result.code, ApprovalOperationCode::Rejected);
    assert!(result.message.contains("already the approved revision"));
}

#[test]
fn delivery_preflight_uses_only_dry_run_from_the_validated_project() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![success("help"), success(&delivery_output(true))]);
    let project_directory = Path::new("/fixed/project");
    let result = run_delivery_operation(
        home.path(),
        project_directory,
        delivery_request(),
        DeliveryOperation::Preflight,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, DeliveryOperationCode::Ready);
    let delivery = result.delivery.unwrap();
    assert_eq!(delivery.approved_revision, 1);
    assert_eq!(delivery.delivered_revision, None);
    assert_eq!(delivery.selected.len(), 2);
    assert_eq!(delivery.selected[1].path, "Stems/Blue Sky Stems.wav");
    assert_eq!(delivery.excluded[0].reason, "revision notes");
    let invocations = runner.invocations.borrow();
    assert_eq!(invocations[1].arguments, vec!["--dry-run"]);
    assert_eq!(
        invocations[1].current_directory,
        Some(project_directory.to_owned())
    );
}

#[test]
fn confirmed_delivery_creation_uses_no_arguments() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![success("help"), success(&delivery_output(false))]);
    let result = run_delivery_operation(
        home.path(),
        Path::new("/fixed/project"),
        delivery_request(),
        DeliveryOperation::Create,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, DeliveryOperationCode::Created);
    assert_eq!(result.delivery.unwrap().delivered_revision, Some(1));
    assert!(runner.invocations.borrow()[1].arguments.is_empty());
}

#[test]
fn overwrite_zip_preflight_uses_only_fixed_release_flags() {
    let home = installed_home("1.3.1");
    let output = delivery_output(true)
        .replace("Delivered revision:  null", "Delivered revision:  1")
        .replace(
            "Replacement mode:    default",
            "Replacement mode:    overwrite",
        )
        .replace("Create ZIP:          no", "Create ZIP:          yes");
    let runner = FakeRunner::new(vec![success("help"), success(&output)]);
    let mut request = delivery_request();
    request.replacement_mode = crate::models::DeliveryReplacementMode::Overwrite;
    request.create_zip = true;

    let result = run_delivery_operation(
        home.path(),
        Path::new("/fixed/project"),
        request,
        DeliveryOperation::Preflight,
        &runner,
    );

    assert!(result.ok);
    let preview = result.delivery.expect("delivery preview");
    assert_eq!(preview.delivered_revision, Some(1));
    assert_eq!(
        preview.replacement_mode,
        crate::models::DeliveryReplacementMode::Overwrite
    );
    assert!(preview.create_zip);
    assert_eq!(
        runner.invocations.borrow()[1].arguments,
        vec!["--overwrite", "--zip", "--dry-run"]
    );
}

#[test]
fn created_zip_requires_the_exact_revisioned_utc_filename() {
    let mut request = delivery_request();
    request.create_zip = true;
    let output = delivery_output(false)
        .replace("Create ZIP:          no", "Create ZIP:          yes")
        + "ZIP:                 blue-sky-rev-01-20260724153045.zip\n";

    let parsed = parse_delivery_output(&output, &request, DeliveryOperation::Create)
        .expect("timestamped ZIP result");
    assert_eq!(
        parsed.zip_name.as_deref(),
        Some("blue-sky-rev-01-20260724153045.zip")
    );

    let legacy = output.replace(
        "blue-sky-rev-01-20260724153045.zip",
        "blue-sky-delivery.zip",
    );
    assert!(parse_delivery_output(&legacy, &request, DeliveryOperation::Create).is_none());

    let wrong_revision = output.replace("-rev-01-", "-rev-02-");
    assert!(parse_delivery_output(&wrong_revision, &request, DeliveryOperation::Create).is_none());
}

#[test]
fn clean_preview_parses_exact_deletions_and_uses_the_clean_flag() {
    let home = installed_home("1.3.1");
    let output = delivery_output(true)
        .replace("Delivered revision:  null", "Delivered revision:  1")
        .replace("Replacement mode:    default", "Replacement mode:    clean")
        .replace(
            "\nWould create:\n",
            "\nWarning: --clean will remove every existing item inside:\n  /fixed/project/05_Final_Delivery\n\nWould delete from 05_Final_Delivery/:\n  Delivery_Notes.md\n  client-reference.pdf\n  delivery-manifest.json\n\nWould create:\n",
        );
    let runner = FakeRunner::new(vec![success("help"), success(&output)]);
    let mut request = delivery_request();
    request.replacement_mode = crate::models::DeliveryReplacementMode::Clean;

    let result = run_delivery_operation(
        home.path(),
        Path::new("/fixed/project"),
        request,
        DeliveryOperation::Preflight,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(
        result.delivery.expect("clean preview").deletions,
        vec![
            "Delivery_Notes.md",
            "client-reference.pdf",
            "delivery-manifest.json"
        ]
    );
    assert_eq!(
        runner.invocations.borrow()[1].arguments,
        vec!["--clean", "--dry-run"]
    );
}

#[test]
fn confirmed_clean_uses_only_the_previously_validated_deletion_inventory() {
    let home = installed_home("1.3.1");
    let output = delivery_output(false)
        .replace("Replacement mode:    default", "Replacement mode:    clean");
    let runner = FakeRunner::new(vec![success("help"), success(&output)]);
    let mut request = delivery_request();
    request.replacement_mode = crate::models::DeliveryReplacementMode::Clean;
    request.confirmed_deletions = vec!["Delivery_Notes.md".into()];

    let result = run_delivery_operation(
        home.path(),
        Path::new("/fixed/project"),
        request,
        DeliveryOperation::Create,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(
        result.delivery.expect("clean result").deletions,
        vec!["Delivery_Notes.md"]
    );
    assert_eq!(runner.invocations.borrow()[1].arguments, vec!["--clean"]);
}

#[test]
fn invalid_delivery_identity_never_starts_a_process() {
    let runner = FakeRunner::new(Vec::new());
    let mut request = delivery_request();
    request.project_id = "Not Valid".into();
    let result = run_delivery_operation(
        Path::new("/home/tester"),
        Path::new("/fixed/project"),
        request,
        DeliveryOperation::Preflight,
        &runner,
    );

    assert_eq!(result.code, DeliveryOperationCode::InvalidInput);
    assert!(runner.invocations.borrow().is_empty());
}

#[test]
fn unverifiable_confirmed_delivery_is_uncertain() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![success("help"), success("created")]);
    let result = run_delivery_operation(
        home.path(),
        Path::new("/fixed/project"),
        delivery_request(),
        DeliveryOperation::Create,
        &runner,
    );

    assert_eq!(result.code, DeliveryOperationCode::Uncertain);
    assert!(result.message.contains("do not retry automatically"));
}

#[test]
fn delivery_rejection_preserves_the_bounded_automation_message() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![
        success("help"),
        failure(5, "No deliverable files were found after applying filters"),
    ]);
    let result = run_delivery_operation(
        home.path(),
        Path::new("/fixed/project"),
        delivery_request(),
        DeliveryOperation::Preflight,
        &runner,
    );

    assert_eq!(result.code, DeliveryOperationCode::Rejected);
    assert!(result.message.contains("No deliverable files"));
}

#[test]
fn intake_preflight_uses_structured_api_from_the_validated_project() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![success("help"), intake_api_response("planned", false)]);
    let project_directory = Path::new("/fixed/project");
    let result = run_intake_operation(
        home.path(),
        project_directory,
        intake_request(),
        IntakeOperation::Preflight,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, IntakeOperationCode::Ready);
    let invocations = runner.invocations.borrow();
    assert_eq!(
        invocations[1].executable,
        home.path().join(".local/bin/jl-mixing")
    );
    assert_eq!(
        invocations[1].arguments,
        vec![
            "intake",
            "validate",
            "--json",
            "--project",
            "/fixed/project",
            "--dry-run"
        ]
    );
    assert_eq!(
        invocations[1].current_directory,
        Some(project_directory.into())
    );
}

#[test]
fn intake_blocked_api_response_is_a_completed_preview_with_blocking_findings() {
    let home = installed_home("1.3.1");
    let runner = FakeRunner::new(vec![success("help"), intake_api_response("blocked", true)]);
    let result = run_intake_operation(
        home.path(),
        Path::new("/fixed/project"),
        intake_request(),
        IntakeOperation::Preflight,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, IntakeOperationCode::BlockingFindings);
    assert_eq!(result.report.unwrap().blocking_errors, 1);
}

#[test]
fn confirmed_intake_run_uses_structured_api_and_embedded_authoritative_report() {
    let home = installed_home("1.3.1");
    let project = tempfile::tempdir().unwrap();
    let runner = FakeRunner::new(vec![success("help"), intake_api_response("success", false)]);
    let result = run_intake_operation(
        home.path(),
        project.path(),
        intake_request(),
        IntakeOperation::Run,
        &runner,
    );

    assert!(result.ok);
    assert_eq!(result.code, IntakeOperationCode::Validated);
    assert_eq!(
        runner.invocations.borrow()[1].arguments,
        vec![
            "intake",
            "validate",
            "--json",
            "--project",
            project.path().to_string_lossy().as_ref()
        ]
    );
    assert_eq!(
        runner.invocations.borrow()[1].current_directory,
        Some(project.path().into())
    );
}

#[test]
fn invalid_intake_identity_never_starts_a_process() {
    let runner = FakeRunner::new(Vec::new());
    let mut invalid = intake_request();
    invalid.project_id = "../unsafe".into();
    let result = run_intake_operation(
        Path::new("/home/tester"),
        Path::new("/fixed/project"),
        invalid,
        IntakeOperation::Preflight,
        &runner,
    );

    assert_eq!(result.code, IntakeOperationCode::InvalidInput);
    assert!(runner.invocations.borrow().is_empty());
}

#[test]
fn unverifiable_confirmed_intake_result_is_uncertain() {
    let home = installed_home("1.3.1");
    let project = tempfile::tempdir().unwrap();
    let runner = FakeRunner::new(vec![
        success("help"),
        success(
            r#"{"api_version":"1.0","operation":"intake.validate","status":"success","data":{"project":{"id":"blue-sky","path":"/fixed/project"},"summary":{"files_discovered":1,"blocking_errors":0,"warnings":0}},"warnings":[],"errors":[]}"#,
        ),
    ]);
    let result = run_intake_operation(
        home.path(),
        project.path(),
        intake_request(),
        IntakeOperation::Run,
        &runner,
    );

    assert_eq!(result.code, IntakeOperationCode::Uncertain);
    assert!(result.message.contains("Do not retry automatically"));
}

#[test]
fn bounds_process_error_output() {
    let message = "x".repeat(MAX_PROCESS_MESSAGE_CHARS + 20);
    let result = bounded_process_message(&message, "", "fallback");
    assert_eq!(result.chars().count(), MAX_PROCESS_MESSAGE_CHARS);
}
