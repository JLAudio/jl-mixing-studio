use super::*;

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
