use super::*;

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
