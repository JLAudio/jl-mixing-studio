use super::*;

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
