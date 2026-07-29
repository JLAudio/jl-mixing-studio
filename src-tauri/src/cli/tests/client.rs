use super::*;

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
