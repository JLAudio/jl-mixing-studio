use super::*;
use std::collections::BTreeMap;

const PROJECT: &str = include_str!("../../../fixtures/project with spaces/project-manifest.json");

#[test]
fn discovers_valid_workspace_and_sorts_case_insensitively() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Music").join("Mixes");
    write_workspace(&root);
    write_client(&root, "z-client", "Zulu Client", "zulu");
    write_client(&root, "a-client", "alpha Client", "alpha");
    write_project(&root, "z-client", "z-project", "Zulu Project", "z-project");
    write_project(&root, "z-client", "a-project", "alpha Project", "a-project");

    let snapshot = discover_workspace_at(&root);

    assert_eq!(snapshot.status, WorkspaceStatus::Healthy);
    assert_eq!(snapshot.counts.clients, 2);
    assert_eq!(snapshot.counts.projects, 2);
    assert_eq!(snapshot.clients[0].client_name, "alpha Client");
    assert_eq!(
        snapshot.clients[1].projects[0].project_name,
        "alpha Project"
    );
    assert_eq!(snapshot.clients[1].projects[1].project_name, "Zulu Project");
    assert_eq!(snapshot.clients[0].created_at, "2026-07-17T12:00:00Z");
    assert!(!snapshot.activity.is_empty());
    assert!(!snapshot.tasks.is_empty());
    let revision = &snapshot.clients[1].projects[0].revisions[0];
    assert_eq!(revision.number, 1);
    assert_eq!(revision.description, "Initial mix");
    assert_eq!(revision.approved_at, None);
}

#[test]
fn discovers_and_correlates_an_authoritative_delivery_manifest() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Mixes");
    write_workspace(&root);
    write_client(&root, "client", "Client", "Artist");
    write_project(&root, "client", "project", "Project", "project");
    write_delivery(&root, "client", "project", false);
    let delivery_path =
        root.join("Clients/client/Projects/project/05_Final_Delivery/delivery-manifest.json");
    let historical = fs::read_to_string(&delivery_path)
        .unwrap()
        .replace("jl-mixing 1.2.0", "jl-mixing 1.1.1");
    fs::write(&delivery_path, historical).unwrap();

    let snapshot = discover_workspace_at(&root);
    let delivery = snapshot.clients[0].projects[0].delivery.as_ref().unwrap();
    assert_eq!(snapshot.status, WorkspaceStatus::Healthy);
    assert_eq!(delivery.created_with, "jl-mixing 1.1.1");
    assert_eq!(delivery.revision, 1);
    assert_eq!(delivery.method, "Download");
    assert_eq!(delivery.files[0].path, "Project Main Mix.wav");
    assert_eq!(delivery.files[0].size_bytes, 12);
}

#[test]
fn preserves_an_immutable_delivery_approval_snapshot_after_reapproval() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Mixes");
    write_workspace(&root);
    write_client(&root, "client", "Client", "Artist");
    write_project(&root, "client", "project", "Project", "project");
    write_delivery(&root, "client", "project", false);

    let manifest_path = root.join("Clients/client/Projects/project/00_Admin/project-manifest.json");
    let mut manifest: Value =
        serde_json::from_str(&fs::read_to_string(&manifest_path).unwrap()).unwrap();
    manifest["revisions"][0]["approval"]["approved_at"] = Value::from("2026-07-18T14:00:00Z");
    manifest["revisions"][0]["approval"]["approved_by"] = Value::from("JL");
    fs::write(
        &manifest_path,
        serde_json::to_string_pretty(&manifest).unwrap(),
    )
    .unwrap();

    let snapshot = discover_workspace_at(&root);
    let delivery = snapshot.clients[0].projects[0].delivery.as_ref().unwrap();
    assert_eq!(snapshot.status, WorkspaceStatus::Healthy);
    assert_eq!(delivery.approved_at, "2026-07-18T12:00:00Z");
    assert_eq!(delivery.approved_by, "Client");
}

#[test]
fn rejects_missing_or_mismatched_delivery_manifests_without_hiding_siblings() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Mixes");
    write_workspace(&root);
    write_client(&root, "client", "Client", "Artist");
    write_project(&root, "client", "good", "Good", "good");
    write_project(&root, "client", "bad", "Bad", "bad");
    write_delivery(&root, "client", "bad", true);

    let snapshot = discover_workspace_at(&root);
    assert_eq!(snapshot.status, WorkspaceStatus::Partial);
    assert_eq!(snapshot.counts.projects, 1);
    assert_eq!(snapshot.clients[0].projects[0].project_id, "good");
    assert_eq!(snapshot.issues[0].code, DiscoveryCode::InvalidSchema);

    let delivery =
        root.join("Clients/client/Projects/bad/05_Final_Delivery/delivery-manifest.json");
    fs::remove_file(delivery).unwrap();
    let missing = discover_workspace_at(&root);
    assert_eq!(missing.status, WorkspaceStatus::Partial);
    assert_eq!(missing.counts.projects, 1);
}

#[test]
fn rejects_inconsistent_revision_history() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Mixes");
    write_workspace(&root);
    write_client(&root, "client", "Client", "Artist");
    write_project(&root, "client", "project", "Project", "project");
    let path = root.join("Clients/client/Projects/project/00_Admin/project-manifest.json");
    let mut manifest: Value =
        serde_json::from_str(&fs::read_to_string(&path).expect("project manifest"))
            .expect("valid project JSON");
    manifest["state"]["current_revision"] = Value::from(2);
    fs::write(
        &path,
        serde_json::to_string_pretty(&manifest).expect("serialize manifest"),
    )
    .expect("inconsistent manifest");

    let snapshot = discover_workspace_at(&root);

    assert_eq!(snapshot.status, WorkspaceStatus::Partial);
    assert_eq!(snapshot.counts.projects, 0);
    assert_eq!(snapshot.issues[0].code, DiscoveryCode::InvalidSchema);
}

#[test]
fn rejects_state_pointers_to_unapproved_revisions() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Mixes");
    write_workspace(&root);
    write_client(&root, "client", "Client", "Artist");
    write_project(&root, "client", "project", "Project", "project");
    let path = root.join("Clients/client/Projects/project/00_Admin/project-manifest.json");
    let mut manifest: Value =
        serde_json::from_str(&fs::read_to_string(&path).expect("project manifest"))
            .expect("valid project JSON");
    manifest["state"]["approved_revision"] = Value::from(1);
    fs::write(
        &path,
        serde_json::to_string_pretty(&manifest).expect("serialize manifest"),
    )
    .expect("inconsistent manifest");

    let snapshot = discover_workspace_at(&root);

    assert_eq!(snapshot.status, WorkspaceStatus::Partial);
    assert_eq!(snapshot.counts.projects, 0);
    assert_eq!(snapshot.issues[0].code, DiscoveryCode::InvalidSchema);
}

#[test]
fn rejects_duplicate_revision_numbers_and_ids() {
    let mut value: Value = serde_json::from_str(PROJECT).expect("valid project JSON");
    value["state"]["current_revision"] = Value::from(2);
    let mut second = value["revisions"][0].clone();
    second["number"] = Value::from(2);
    value["revisions"]
        .as_array_mut()
        .expect("revision array")
        .push(second);
    let manifest: ProjectManifest = serde_json::from_value(value).expect("project manifest shape");

    assert!(matches!(
        validate_revision_history(&manifest),
        Err(DocumentFailure::InvalidSchema)
    ));

    let mut value: Value = serde_json::from_str(PROJECT).expect("valid project JSON");
    value["state"]["current_revision"] = Value::from(2);
    let mut duplicate = value["revisions"][0].clone();
    duplicate["revision_id"] = Value::from("a6ab015f-9c75-4de6-b3ba-e457f308ded1");
    value["revisions"]
        .as_array_mut()
        .expect("revision array")
        .push(duplicate);
    let manifest: ProjectManifest = serde_json::from_value(value).expect("project manifest shape");

    assert!(matches!(
        validate_revision_history(&manifest),
        Err(DocumentFailure::InvalidSchema)
    ));
}

#[test]
fn rejects_gapped_revision_numbers() {
    let mut value: Value = serde_json::from_str(PROJECT).expect("valid project JSON");
    value["state"]["current_revision"] = Value::from(3);
    let mut third = value["revisions"][0].clone();
    third["number"] = Value::from(3);
    third["revision_id"] = Value::from("a6ab015f-9c75-4de6-b3ba-e457f308ded1");
    let mut fourth = value["revisions"][0].clone();
    fourth["number"] = Value::from(4);
    fourth["revision_id"] = Value::from("cc318b30-1b52-43fa-9f42-bc5216789f9b");
    let revisions = value["revisions"].as_array_mut().expect("revision array");
    revisions.push(third);
    revisions.push(fourth);
    let manifest: ProjectManifest = serde_json::from_value(value).expect("project manifest shape");

    assert!(matches!(
        validate_revision_history(&manifest),
        Err(DocumentFailure::InvalidSchema)
    ));
}

#[test]
fn reports_missing_and_empty_workspaces() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let missing = discover_workspace_at(&temp.path().join("missing"));
    assert_eq!(missing.status, WorkspaceStatus::Unavailable);

    let root = temp.path().join("Mixes");
    write_workspace(&root);
    let empty = discover_workspace_at(&root);
    assert_eq!(empty.status, WorkspaceStatus::Empty);
    assert_eq!(empty.counts, WorkspaceCounts::default());
}

#[test]
fn preserves_valid_projects_when_a_sibling_is_invalid() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Mixes");
    write_workspace(&root);
    write_client(&root, "client", "Client", "Artist");
    write_project(&root, "client", "good", "Good Project", "good-project");
    let bad = root
        .join("Clients")
        .join("client")
        .join("Projects")
        .join("bad")
        .join("00_Admin");
    fs::create_dir_all(&bad).expect("bad project directory");
    fs::write(bad.join("project-manifest.json"), "{").expect("bad manifest");

    let snapshot = discover_workspace_at(&root);

    assert_eq!(snapshot.status, WorkspaceStatus::Partial);
    assert_eq!(snapshot.counts.projects, 1);
    assert_eq!(snapshot.counts.issues, 1);
    assert_eq!(snapshot.issues[0].code, DiscoveryCode::InvalidJson);
}

#[test]
fn rejects_unsupported_schema_but_accepts_historical_created_with() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Mixes");
    write_workspace(&root);
    write_client(&root, "client", "Client", "Artist");
    write_project(&root, "client", "old", "Old Project", "old-project");
    let manifest = root.join("Clients/client/Projects/old/00_Admin/project-manifest.json");
    let historical = fs::read_to_string(&manifest)
        .expect("manifest")
        .replace("jl-mixing 1.2.0", "jl-mixing 1.1.1");
    fs::write(&manifest, historical).expect("historical manifest");
    assert_eq!(
        discover_workspace_at(&root).status,
        WorkspaceStatus::Healthy
    );

    let unsupported = fs::read_to_string(&manifest).expect("manifest").replace(
        "\"schema_version\": \"1.1.0\"",
        "\"schema_version\": \"2.0.0\"",
    );
    fs::write(&manifest, unsupported).expect("unsupported manifest");
    let snapshot = discover_workspace_at(&root);
    assert_eq!(snapshot.status, WorkspaceStatus::Partial);
    assert_eq!(snapshot.issues[0].code, DiscoveryCode::UnsupportedSchema);
}

#[test]
fn repeated_discovery_does_not_modify_workspace() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Mixes with spaces");
    write_workspace(&root);
    write_client(&root, "client with spaces", "Client With Spaces", "Artist");
    write_project(
        &root,
        "client with spaces",
        "project with spaces",
        "Project With Spaces",
        "project-with-spaces",
    );
    let before = file_snapshot(&root);

    discover_workspace_at(&root);
    discover_workspace_at(&root);

    assert_eq!(file_snapshot(&root), before);
}

#[test]
fn resolves_a_validated_client_directory_by_stable_id() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Mixes");
    write_workspace(&root);
    write_client(&root, "Acme Records", "Acme Records", "The Artist");

    assert_eq!(
        find_validated_client_path(&root, "acme-records"),
        Some(root.join("Clients/Acme Records"))
    );
    assert_eq!(find_validated_client_path(&root, "missing"), None);
}

#[test]
fn refuses_an_ambiguous_client_id() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Mixes");
    write_workspace(&root);
    write_client(&root, "duplicate-id", "First Client", "Artist");
    write_client(&root, "duplicate id", "Second Client", "Artist");

    assert_eq!(find_validated_client_path(&root, "duplicate-id"), None);
}

#[test]
fn resolves_a_validated_project_directory_by_stable_id() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Mixes");
    write_workspace(&root);
    write_client(&root, "Acme Records", "Acme Records", "The Artist");
    write_project(&root, "Acme Records", "Blue Sky", "Blue Sky", "blue-sky");

    assert_eq!(
        find_validated_project_path(&root, "acme-records", "blue-sky"),
        Some(root.join("Clients/Acme Records/Projects/Blue Sky"))
    );
    assert_eq!(
        find_validated_project_path(&root, "acme-records", "missing"),
        None
    );
}

#[test]
fn refuses_an_ambiguous_project_id() {
    let temp = tempfile::tempdir().expect("temporary directory");
    let root = temp.path().join("Mixes");
    write_workspace(&root);
    write_client(&root, "client", "Client", "Artist");
    write_project(&root, "client", "first", "First", "duplicate-project");
    write_project(&root, "client", "second", "Second", "duplicate-project");

    assert_eq!(
        find_validated_project_path(&root, "client", "duplicate-project"),
        None
    );
}

fn write_workspace(root: &Path) {
    fs::create_dir_all(root.join("Studio")).expect("studio directory");
    fs::create_dir_all(root.join("Clients")).expect("clients directory");
    fs::write(
            root.join("Studio/studio.json"),
            format!(
                r#"{{
                  "metadata": {{"schema":"mixing-studio","schema_version":"1.1.0","document_id":"31a6f754-c1d0-4565-8f95-563d8dc1a61f","created_with":"jl-mixing 1.2.0","created_at":"2026-07-17T12:00:00Z","last_modified_at":"2026-07-17T12:00:00Z"}},
                  "studio_id":"test-studio","studio_name":"Test Studio","root_path":"{}",
                  "defaults":{{"mix_engineer":"","audio":{{"sample_rate":48000,"bit_depth":24,"file_format":"WAV"}},"delivery":{{"method":"Download","requested_deliverables":["main_mix"]}}}},
                  "cli":{{"change_directory_after_create":false}}
                }}"#,
                root.to_string_lossy()
            ),
        )
        .expect("studio file");
}

fn write_client(root: &Path, directory: &str, name: &str, artist: &str) {
    let path = root.join("Clients").join(directory);
    fs::create_dir_all(path.join("Projects")).expect("project directory");
    fs::write(
            path.join("client.json"),
            format!(
                r#"{{
                  "metadata":{{"schema":"mixing-client","schema_version":"1.1.0","document_id":"5049c004-f18e-4cd0-ae59-35d354ce9b35","created_with":"jl-mixing 1.2.0","created_at":"2026-07-17T12:00:00Z","last_modified_at":"2026-07-17T12:00:00Z"}},
                  "client_id":"{}","client_name":"{}",
                  "defaults":{{"artist":"{}","audio":{{"sample_rate":48000,"bit_depth":24,"file_format":"WAV"}},"delivery":{{"method":"Download","requested_deliverables":["main_mix"]}}}}
                }}"#,
                directory.replace(' ', "-").to_ascii_lowercase(),
                name,
                artist
            ),
        )
        .expect("client file");
}

fn write_project(
    root: &Path,
    client_directory: &str,
    project_directory: &str,
    name: &str,
    id: &str,
) {
    let path = root
        .join("Clients")
        .join(client_directory)
        .join("Projects")
        .join(project_directory)
        .join("00_Admin");
    fs::create_dir_all(&path).expect("admin directory");
    let project = PROJECT
        .replace("Architecture Spike", name)
        .replace("architecture-spike", id);
    fs::write(path.join("project-manifest.json"), project).expect("project manifest");
}

fn write_delivery(root: &Path, client: &str, project: &str, mismatch: bool) {
    let project_root = root
        .join("Clients")
        .join(client)
        .join("Projects")
        .join(project);
    let manifest_path = project_root.join("00_Admin/project-manifest.json");
    let mut manifest: Value =
        serde_json::from_str(&fs::read_to_string(&manifest_path).unwrap()).unwrap();
    manifest["state"]["approved_revision"] = Value::from(1);
    manifest["state"]["delivered_revision"] = Value::from(1);
    manifest["revisions"][0]["approval"]["approved_at"] = Value::from("2026-07-18T12:00:00Z");
    manifest["revisions"][0]["approval"]["approved_by"] = Value::from("Client");
    fs::write(
        &manifest_path,
        serde_json::to_string_pretty(&manifest).unwrap(),
    )
    .unwrap();
    let delivery_root = project_root.join("05_Final_Delivery");
    fs::create_dir_all(&delivery_root).unwrap();
    let project_id = manifest["project_id"].as_str().unwrap();
    let project_name = manifest["project_name"].as_str().unwrap();
    let project_document_id = manifest["metadata"]["document_id"].as_str().unwrap();
    let revision_id = manifest["revisions"][0]["revision_id"].as_str().unwrap();
    let recorded_project = if mismatch {
        "wrong-project"
    } else {
        project_id
    };
    let delivery = serde_json::json!({
        "metadata":{"schema":"mixing-delivery","schema_version":"1.1.0","document_id":"f5a3d96c-5d1a-4d0f-9712-cfc4f070d065","created_with":"jl-mixing 1.2.0","created_at":"2026-07-18T13:00:00Z"},
        "project":{"project_document_id":project_document_id,"project_id":recorded_project,"project_name":project_name},
        "client":{"client_document_id":"5049c004-f18e-4cd0-ae59-35d354ce9b35","client_id":client},
        "revision":{"number":1,"revision_id":revision_id,"description":"Initial mix","approval":{"approved_at":"2026-07-18T12:00:00Z","approved_by":"Client"}},
        "delivery":{"method":"Download"},
        "files":[{"path":"Project Main Mix.wav","deliverable_type":"main_mix","size_bytes":12,"sha256":"0000000000000000000000000000000000000000000000000000000000000000"}]
    });
    fs::write(
        delivery_root.join("delivery-manifest.json"),
        serde_json::to_string_pretty(&delivery).unwrap(),
    )
    .unwrap();
}

fn file_snapshot(root: &Path) -> BTreeMap<String, Vec<u8>> {
    fn visit(root: &Path, path: &Path, files: &mut BTreeMap<String, Vec<u8>>) {
        for entry in fs::read_dir(path).expect("read directory") {
            let entry = entry.expect("directory entry");
            if entry.path().is_dir() {
                visit(root, &entry.path(), files);
            } else {
                files.insert(
                    relative_path(root, &entry.path()),
                    fs::read(entry.path()).expect("read file"),
                );
            }
        }
    }
    let mut files = BTreeMap::new();
    visit(root, root, &mut files);
    files
}
