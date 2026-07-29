use super::*;

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
