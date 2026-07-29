use super::*;

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
