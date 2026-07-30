use super::*;

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
