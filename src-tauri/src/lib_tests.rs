use super::*;
use crate::models::{DeliveryFile, DeliverySummary, PlannedDeliveryFile, RevisionSummary};
use tempfile::tempdir;

fn project_with_two_revisions() -> ProjectSummary {
    ProjectSummary {
        project_id: "blue-sky".into(),
        project_name: "Blue Sky".into(),
        artist: "The Artist".into(),
        schema_version: "1.1.0".into(),
        created_with: "jl-mixing 1.2.0".into(),
        created_at: "2026-07-16T10:00:00Z".into(),
        deadline: Some("2026-07-31".into()),
        sample_rate: 48_000,
        bit_depth: 24,
        file_format: "WAV".into(),
        delivery_method: "Download".into(),
        current_revision: 2,
        approved_revision: Some(1),
        delivered_revision: None,
        delivery: None,
        revisions: vec![
            RevisionSummary {
                number: 1,
                revision_id: "45a87315-78b0-4cc5-a971-e0a34b394cf5".into(),
                created_at: "2026-07-16T12:00:00Z".into(),
                description: "Initial mix".into(),
                approved_at: Some("2026-07-17T12:00:00Z".into()),
                approved_by: Some("Client Reviewer".into()),
            },
            RevisionSummary {
                number: 2,
                revision_id: "838e1b52-e8d3-48c7-8a8d-179c985d4bbc".into(),
                created_at: "2026-07-17T18:00:00Z".into(),
                description: "Balance update".into(),
                approved_at: None,
                approved_by: None,
            },
        ],
    }
}

fn expected_revision() -> RevisionCreationSummary {
    RevisionCreationSummary {
        client_id: "acme".into(),
        project_id: "blue-sky".into(),
        number: 3,
        description: "Vocal lift".into(),
    }
}

fn project_after_revision_creation() -> ProjectSummary {
    let mut project = project_with_two_revisions();
    project.current_revision = 3;
    project.revisions.push(RevisionSummary {
        number: 3,
        revision_id: "dd0cb190-bd55-4200-bca0-b5472cbef368".into(),
        created_at: "2026-07-18T12:00:00Z".into(),
        description: "Vocal lift".into(),
        approved_at: None,
        approved_by: None,
    });
    project
}

fn expected_approval(revision: u32) -> RevisionApprovalSummary {
    RevisionApprovalSummary {
        client_id: "acme".into(),
        project_id: "blue-sky".into(),
        revision,
        approved_by: "Client".into(),
        approved_at: Some("2026-07-18T13:00:00Z".into()),
    }
}

fn project_after_revision_approval(revision: u32) -> ProjectSummary {
    let mut project = project_with_two_revisions();
    project.approved_revision = Some(revision);
    let selected = project
        .revisions
        .iter_mut()
        .find(|candidate| candidate.number == revision)
        .unwrap();
    selected.approved_by = Some("Client".into());
    selected.approved_at = Some("2026-07-18T13:00:00Z".into());
    project
}

fn expected_delivery() -> DeliveryCreationPreview {
    DeliveryCreationPreview {
        client_id: "acme".into(),
        project_id: "blue-sky".into(),
        project_name: "Blue Sky".into(),
        current_revision: 2,
        approved_revision: 1,
        delivered_revision: Some(1),
        delivery_method: "Download".into(),
        replacement_mode: crate::models::DeliveryReplacementMode::Default,
        create_zip: false,
        zip_name: None,
        selected: vec![PlannedDeliveryFile {
            source_name: "Blue Sky Main Mix.wav".into(),
            deliverable_type: "main_mix".into(),
            path: "Blue Sky Main Mix.wav".into(),
        }],
        excluded: Vec::new(),
        deletions: Vec::new(),
    }
}

fn project_after_delivery_creation() -> ProjectSummary {
    let mut project = project_with_two_revisions();
    project.delivered_revision = Some(1);
    project.delivery = Some(DeliverySummary {
        document_id: "f5a3d96c-5d1a-4d0f-9712-cfc4f070d065".into(),
        created_with: "jl-mixing 1.2.0".into(),
        created_at: "2026-07-18T14:00:00Z".into(),
        method: "Download".into(),
        revision: 1,
        revision_id: project.revisions[0].revision_id.clone(),
        description: project.revisions[0].description.clone(),
        approved_at: project.revisions[0].approved_at.clone().unwrap(),
        approved_by: project.revisions[0].approved_by.clone().unwrap(),
        files: vec![DeliveryFile {
            path: "Blue Sky Main Mix.wav".into(),
            deliverable_type: "main_mix".into(),
            size_bytes: 12,
            sha256: "0".repeat(64),
        }],
    });
    project
}

#[test]
fn only_healthy_and_empty_workspaces_allow_client_creation() {
    assert!(workspace_allows_client_creation(WorkspaceStatus::Healthy));
    assert!(workspace_allows_client_creation(WorkspaceStatus::Empty));
    assert!(!workspace_allows_client_creation(WorkspaceStatus::Partial));
    assert!(!workspace_allows_client_creation(
        WorkspaceStatus::Unavailable
    ));
    assert!(!workspace_allows_client_creation(WorkspaceStatus::Invalid));
}

#[test]
fn intake_folder_uses_the_automation_project_layout() {
    assert_eq!(
        intake_directory(Path::new("/workspace/project")),
        Path::new("/workspace/project")
            .join("01_Client_Files")
            .join("Original_Delivery")
    );
}

#[test]
fn only_healthy_workspaces_allow_project_creation() {
    assert!(workspace_allows_project_creation(WorkspaceStatus::Healthy));
    assert!(!workspace_allows_project_creation(WorkspaceStatus::Empty));
    assert!(!workspace_allows_project_creation(WorkspaceStatus::Partial));
    assert!(!workspace_allows_project_creation(
        WorkspaceStatus::Unavailable
    ));
    assert!(!workspace_allows_project_creation(WorkspaceStatus::Invalid));
}

#[test]
fn intake_reports_remain_readable_in_partial_workspaces() {
    assert!(workspace_allows_intake_report_read(
        WorkspaceStatus::Healthy
    ));
    assert!(workspace_allows_intake_report_read(
        WorkspaceStatus::Partial
    ));
    assert!(!workspace_allows_intake_report_read(WorkspaceStatus::Empty));
    assert!(!workspace_allows_intake_report_read(
        WorkspaceStatus::Invalid
    ));
}

#[test]
fn only_healthy_workspaces_allow_intake_validation() {
    assert!(workspace_allows_intake_validation(WorkspaceStatus::Healthy));
    assert!(!workspace_allows_intake_validation(
        WorkspaceStatus::Partial
    ));
    assert!(!workspace_allows_intake_validation(WorkspaceStatus::Empty));
    assert!(!workspace_allows_intake_validation(
        WorkspaceStatus::Invalid
    ));
}

#[test]
fn only_healthy_workspaces_allow_revision_creation() {
    assert!(workspace_allows_revision_creation(WorkspaceStatus::Healthy));
    assert!(!workspace_allows_revision_creation(
        WorkspaceStatus::Partial
    ));
    assert!(!workspace_allows_revision_creation(WorkspaceStatus::Empty));
    assert!(!workspace_allows_revision_creation(
        WorkspaceStatus::Invalid
    ));
}

#[test]
fn only_healthy_workspaces_allow_revision_approval() {
    assert!(workspace_allows_revision_approval(WorkspaceStatus::Healthy));
    assert!(!workspace_allows_revision_approval(
        WorkspaceStatus::Partial
    ));
    assert!(!workspace_allows_revision_approval(WorkspaceStatus::Empty));
    assert!(!workspace_allows_revision_approval(
        WorkspaceStatus::Invalid
    ));
}

#[test]
fn only_healthy_workspaces_allow_delivery_creation() {
    assert!(workspace_allows_delivery_creation(WorkspaceStatus::Healthy));
    assert!(!workspace_allows_delivery_creation(
        WorkspaceStatus::Partial
    ));
    assert!(!workspace_allows_delivery_creation(WorkspaceStatus::Empty));
    assert!(!workspace_allows_delivery_creation(
        WorkspaceStatus::Invalid
    ));
}

#[test]
fn verifies_one_authoritative_revision_and_preserved_lifecycle_state() {
    assert!(verify_revision_creation(
        &project_with_two_revisions(),
        &project_after_revision_creation(),
        &expected_revision(),
    ));
}

#[test]
fn rejects_reconciliation_when_prior_history_or_pointers_change() {
    let before = project_with_two_revisions();
    let mut changed_history = project_after_revision_creation();
    changed_history.revisions[0].description = "Changed".into();
    assert!(!verify_revision_creation(
        &before,
        &changed_history,
        &expected_revision(),
    ));

    let mut changed_pointer = project_after_revision_creation();
    changed_pointer.approved_revision = None;
    assert!(!verify_revision_creation(
        &before,
        &changed_pointer,
        &expected_revision(),
    ));
}

#[test]
fn rejects_reconciliation_when_new_revision_reuses_an_identity() {
    let before = project_with_two_revisions();
    let mut after = project_after_revision_creation();
    after.revisions[2].revision_id = before.revisions[0].revision_id.clone();
    assert!(!verify_revision_creation(
        &before,
        &after,
        &expected_revision(),
    ));
}

#[test]
fn verifies_only_selected_approval_and_pointer_change() {
    assert!(verify_revision_approval(
        &project_with_two_revisions(),
        &project_after_revision_approval(2),
        &expected_approval(2),
    ));
}

#[test]
fn verifies_historical_reapproval_without_changing_other_records() {
    let mut before = project_with_two_revisions();
    before.approved_revision = Some(2);
    before.revisions[1].approved_by = Some("Earlier Reviewer".into());
    before.revisions[1].approved_at = Some("2026-07-17T19:00:00Z".into());
    let mut after = before.clone();
    after.approved_revision = Some(1);
    after.revisions[0].approved_by = Some("Client".into());
    after.revisions[0].approved_at = Some("2026-07-18T13:00:00Z".into());

    assert!(verify_revision_approval(
        &before,
        &after,
        &expected_approval(1),
    ));
}

#[test]
fn rejects_approval_reconciliation_when_unselected_history_or_delivery_changes() {
    let before = project_with_two_revisions();
    let mut changed_history = project_after_revision_approval(2);
    changed_history.revisions[0].description = "Changed".into();
    assert!(!verify_revision_approval(
        &before,
        &changed_history,
        &expected_approval(2),
    ));

    let mut changed_delivery = project_after_revision_approval(2);
    changed_delivery.delivered_revision = Some(1);
    assert!(!verify_revision_approval(
        &before,
        &changed_delivery,
        &expected_approval(2),
    ));
}

#[test]
fn verifies_exact_first_delivery_transition() {
    assert!(verify_delivery_creation(
        &project_with_two_revisions(),
        &project_after_delivery_creation(),
        &expected_delivery(),
    ));
}

#[test]
fn accepts_preserved_delivery_files_not_selected_by_the_current_revision() {
    let before = project_with_two_revisions();
    let mut after = project_after_delivery_creation();
    after.delivery.as_mut().unwrap().files.push(DeliveryFile {
        path: "client-reference.pdf".into(),
        deliverable_type: "attachment".into(),
        size_bytes: 24,
        sha256: "1".repeat(64),
    });

    assert!(verify_delivery_creation(
        &before,
        &after,
        &expected_delivery(),
    ));
}

#[test]
fn rejects_delivery_reconciliation_when_history_or_files_change() {
    let before = project_with_two_revisions();
    let mut changed_history = project_after_delivery_creation();
    changed_history.revisions[0].description = "Changed".into();
    assert!(!verify_delivery_creation(
        &before,
        &changed_history,
        &expected_delivery(),
    ));

    let mut changed_files = project_after_delivery_creation();
    changed_files.delivery.as_mut().unwrap().files[0].path = "Other.wav".into();
    assert!(!verify_delivery_creation(
        &before,
        &changed_files,
        &expected_delivery(),
    ));
}

#[test]
fn replaces_and_reads_delivery_notes_exactly() {
    let directory = tempdir().expect("temporary directory");
    let notes = directory.path().join("Delivery_Notes.md");
    fs::write(&notes, "Original\n").expect("original notes");

    write_delivery_notes(&notes, "# Delivery\n\nUpdated handoff.\n").expect("save notes");

    let document = read_delivery_notes(&notes).expect("read notes");
    assert_eq!(document.content, "# Delivery\n\nUpdated handoff.\n");
    assert_eq!(document.max_bytes, DELIVERY_NOTES_MAX_BYTES);
}

#[test]
fn rejects_oversized_delivery_notes_before_reading_content() {
    let directory = tempdir().expect("temporary directory");
    let notes = directory.path().join("Delivery_Notes.md");
    fs::write(&notes, vec![b'a'; DELIVERY_NOTES_MAX_BYTES + 1]).expect("large notes");

    assert!(read_delivery_notes(&notes)
        .expect_err("oversized notes must fail")
        .contains("editor limit"));
}

#[test]
fn verifies_requested_zip_and_preserved_overwrite_notes() {
    let directory = tempdir().expect("temporary directory");
    let delivery = directory.path().join("05_Final_Delivery");
    fs::create_dir(&delivery).expect("delivery directory");
    fs::write(delivery.join("Delivery_Notes.md"), "Edited notes\n").expect("notes");
    fs::write(delivery.join("blue-sky-rev-01-20260724153045.zip"), "zip").expect("zip");
    let mut expected = expected_delivery();
    expected.replacement_mode = DeliveryReplacementMode::Overwrite;
    expected.create_zip = true;
    expected.zip_name = Some("blue-sky-rev-01-20260724153045.zip".into());

    assert!(verify_delivery_artifacts(
        directory.path(),
        &expected,
        Some(b"Edited notes\n"),
    ));
    assert!(!verify_delivery_artifacts(
        directory.path(),
        &expected,
        Some(b"Different notes\n"),
    ));
}

#[test]
fn lists_clean_deletions_with_nested_relative_paths() {
    let directory = tempdir().expect("temporary directory");
    let delivery = directory.path().join("05_Final_Delivery");
    fs::create_dir_all(delivery.join("Stems")).expect("delivery directory");
    fs::write(delivery.join("Delivery_Notes.md"), "Notes\n").expect("notes");
    fs::write(delivery.join("Stems/Drums.wav"), "audio").expect("stem");

    assert_eq!(
        list_delivery_entries(directory.path()).expect("deletion inventory"),
        vec!["Delivery_Notes.md", "Stems/", "Stems/Drums.wav"]
    );
}

#[test]
fn clean_artifact_verification_rejects_unpreviewed_survivors() {
    let directory = tempdir().expect("temporary directory");
    let delivery = directory.path().join("05_Final_Delivery");
    fs::create_dir(&delivery).expect("delivery directory");
    fs::write(delivery.join("Delivery_Notes.md"), "Fresh template\n").expect("notes");
    fs::write(delivery.join("delivery-manifest.json"), "{}").expect("manifest");
    fs::write(delivery.join("Blue Sky Main Mix.wav"), "new audio").expect("audio");
    let mut expected = expected_delivery();
    expected.replacement_mode = DeliveryReplacementMode::Clean;
    expected.deletions = vec![
        "Blue Sky Main Mix.wav".into(),
        "Delivery_Notes.md".into(),
        "delivery-manifest.json".into(),
        "untracked.txt".into(),
    ];

    assert!(verify_delivery_artifacts(directory.path(), &expected, None,));
    fs::write(delivery.join("untracked.txt"), "survivor").expect("untracked file");
    assert!(!verify_delivery_artifacts(
        directory.path(),
        &expected,
        None,
    ));
}
