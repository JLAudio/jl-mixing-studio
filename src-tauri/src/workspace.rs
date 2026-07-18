use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::models::{
    ClientDocument, ClientSummary, DiscoveryCode, DiscoveryIssue, DiscoveryScope, ProjectManifest,
    ProjectSummary, RevisionSummary, StudioDocument, StudioSummary, WorkspaceCounts,
    WorkspaceSnapshot, WorkspaceStatus,
};

const STUDIO_SCHEMA: &str = include_str!("../../schemas/jl-mixing-v1.2.0/studio.schema.json");
const CLIENT_SCHEMA: &str = include_str!("../../schemas/jl-mixing-v1.2.0/client.schema.json");
const PROJECT_SCHEMA: &str =
    include_str!("../../schemas/jl-mixing-v1.2.0/project-manifest.schema.json");
const SUPPORTED_SCHEMA_VERSION: &str = "1.1.0";

pub fn discover_workspace_at(root: &Path) -> WorkspaceSnapshot {
    let workspace_path = root.to_string_lossy().into_owned();
    if !root.is_dir() {
        return WorkspaceSnapshot {
            workspace_path,
            status: WorkspaceStatus::Unavailable,
            studio: None,
            counts: WorkspaceCounts {
                issues: 1,
                ..WorkspaceCounts::default()
            },
            clients: Vec::new(),
            issues: vec![issue(
                DiscoveryScope::Workspace,
                DiscoveryCode::NotFound,
                None,
                None,
                "The default JL Mixing workspace was not found",
                "Install JL Mixing Automation and run new-studio to create ~/Music/Mixes.",
            )],
        };
    }

    let studio_path = root.join("Studio").join("studio.json");
    let studio_document =
        match read_document::<StudioDocument>(&studio_path, STUDIO_SCHEMA, "mixing-studio") {
            Ok(document) => document,
            Err(failure) => {
                let problem = failure.into_issue(root, &studio_path, DiscoveryScope::Studio, None);
                return WorkspaceSnapshot {
                    workspace_path,
                    status: WorkspaceStatus::Invalid,
                    studio: None,
                    counts: WorkspaceCounts {
                        issues: 1,
                        ..WorkspaceCounts::default()
                    },
                    clients: Vec::new(),
                    issues: vec![problem],
                };
            }
        };

    let studio = StudioSummary {
        studio_id: studio_document.studio_id,
        studio_name: studio_document.studio_name,
        schema_version: studio_document.metadata.schema_version,
        created_with: studio_document.metadata.created_with,
    };

    let clients_path = root.join("Clients");
    let entries = match directory_entries(&clients_path) {
        Ok(entries) => entries,
        Err(failure) => {
            let problem = failure.into_issue(root, &clients_path, DiscoveryScope::Workspace, None);
            return WorkspaceSnapshot {
                workspace_path,
                status: WorkspaceStatus::Invalid,
                studio: Some(studio),
                counts: WorkspaceCounts {
                    issues: 1,
                    ..WorkspaceCounts::default()
                },
                clients: Vec::new(),
                issues: vec![problem],
            };
        }
    };

    let mut discovered_clients = Vec::new();
    let mut issues = Vec::new();

    for client_path in entries {
        if !client_path.is_dir() {
            continue;
        }
        if is_symlink(&client_path) {
            issues.push(issue_for_path(
                root,
                &client_path,
                DiscoveryScope::Client,
                DiscoveryCode::Unreadable,
                Some(file_name(&client_path)),
                "Symbolic-link client directories are not inspected",
                "Replace the symbolic link with a client directory inside the workspace.",
            ));
            continue;
        }

        let client_file = client_path.join("client.json");
        let client =
            match read_document::<ClientDocument>(&client_file, CLIENT_SCHEMA, "mixing-client") {
                Ok(client) => client,
                Err(failure) => {
                    issues.push(failure.into_issue(
                        root,
                        &client_file,
                        DiscoveryScope::Client,
                        Some(file_name(&client_path)),
                    ));
                    continue;
                }
            };

        let projects_path = client_path.join("Projects");
        let project_entries = match directory_entries(&projects_path) {
            Ok(entries) => entries,
            Err(failure) => {
                issues.push(failure.into_issue(
                    root,
                    &projects_path,
                    DiscoveryScope::Client,
                    Some(client.client_name.clone()),
                ));
                Vec::new()
            }
        };

        let mut projects_with_paths = Vec::new();
        for project_path in project_entries {
            if !project_path.is_dir() {
                continue;
            }
            if is_symlink(&project_path) {
                issues.push(issue_for_path(
                    root,
                    &project_path,
                    DiscoveryScope::Project,
                    DiscoveryCode::Unreadable,
                    Some(file_name(&project_path)),
                    "Symbolic-link project directories are not inspected",
                    "Replace the symbolic link with a project directory inside the workspace.",
                ));
                continue;
            }

            let manifest_path = project_path.join("00_Admin").join("project-manifest.json");
            let manifest = match read_project_document(&manifest_path) {
                Ok(manifest) => manifest,
                Err(failure) => {
                    issues.push(failure.into_issue(
                        root,
                        &manifest_path,
                        DiscoveryScope::Project,
                        Some(file_name(&project_path)),
                    ));
                    continue;
                }
            };

            let mut revisions: Vec<_> = manifest
                .revisions
                .into_iter()
                .map(|revision| RevisionSummary {
                    number: revision.number,
                    revision_id: revision.revision_id,
                    created_at: revision.created_at,
                    description: revision.description,
                    approved_at: revision.approval.approved_at,
                    approved_by: revision.approval.approved_by,
                })
                .collect();
            revisions.sort_by_key(|revision| revision.number);
            let summary = ProjectSummary {
                project_id: manifest.project_id,
                project_name: manifest.project_name,
                artist: manifest.artist,
                schema_version: manifest.metadata.schema_version,
                created_with: manifest.metadata.created_with,
                sample_rate: manifest.audio.sample_rate,
                bit_depth: manifest.audio.bit_depth,
                file_format: manifest.audio.file_format,
                current_revision: manifest.state.current_revision,
                approved_revision: manifest.state.approved_revision,
                delivered_revision: manifest.state.delivered_revision,
                revisions,
            };
            projects_with_paths.push((summary, relative_path(root, &project_path)));
        }

        projects_with_paths.sort_by(|left, right| {
            lower(&left.0.project_name)
                .cmp(&lower(&right.0.project_name))
                .then_with(|| left.0.project_id.cmp(&right.0.project_id))
                .then_with(|| left.1.cmp(&right.1))
        });

        discovered_clients.push((
            ClientSummary {
                client_id: client.client_id,
                client_name: client.client_name,
                default_artist: client.defaults.artist,
                projects: projects_with_paths
                    .into_iter()
                    .map(|(project, _)| project)
                    .collect(),
            },
            relative_path(root, &client_path),
        ));
    }

    discovered_clients.sort_by(|left, right| {
        lower(&left.0.client_name)
            .cmp(&lower(&right.0.client_name))
            .then_with(|| left.0.client_id.cmp(&right.0.client_id))
            .then_with(|| left.1.cmp(&right.1))
    });
    issues.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));

    let clients: Vec<_> = discovered_clients
        .into_iter()
        .map(|(client, _)| client)
        .collect();
    let project_count = clients.iter().map(|client| client.projects.len()).sum();
    let status = if !issues.is_empty() {
        WorkspaceStatus::Partial
    } else if clients.is_empty() {
        WorkspaceStatus::Empty
    } else {
        WorkspaceStatus::Healthy
    };

    WorkspaceSnapshot {
        workspace_path,
        status,
        studio: Some(studio),
        counts: WorkspaceCounts {
            clients: clients.len(),
            projects: project_count,
            issues: issues.len(),
        },
        clients,
        issues,
    }
}

/// Resolves one validated client directory without accepting a frontend path.
/// Duplicate IDs are treated as unavailable so the caller can never choose an
/// ambiguous working directory.
pub fn find_validated_client_path(root: &Path, client_id: &str) -> Option<PathBuf> {
    let clients_path = root.join("Clients");
    let mut matches = directory_entries(&clients_path)
        .ok()?
        .into_iter()
        .filter(|path| path.is_dir() && !is_symlink(path))
        .filter(|path| {
            read_document::<ClientDocument>(
                &path.join("client.json"),
                CLIENT_SCHEMA,
                "mixing-client",
            )
            .is_ok_and(|client| client.client_id == client_id)
        });
    let matched = matches.next()?;
    if matches.next().is_some() {
        return None;
    }
    Some(matched)
}

/// Resolves one validated project directory from stable identities only.
/// Duplicate project IDs are rejected so an action cannot target an ambiguous
/// directory even when a partially valid workspace remains browsable.
pub fn find_validated_project_path(
    root: &Path,
    client_id: &str,
    project_id: &str,
) -> Option<PathBuf> {
    let client_path = find_validated_client_path(root, client_id)?;
    let mut matches = directory_entries(&client_path.join("Projects"))
        .ok()?
        .into_iter()
        .filter(|path| path.is_dir() && !is_symlink(path))
        .filter(|path| {
            read_project_document(&path.join("00_Admin").join("project-manifest.json"))
                .is_ok_and(|project| project.project_id == project_id)
        });
    let matched = matches.next()?;
    if matches.next().is_some() {
        return None;
    }
    Some(matched)
}

fn read_document<T: DeserializeOwned>(
    path: &Path,
    schema_json: &str,
    expected_schema: &str,
) -> Result<T, DocumentFailure> {
    let content = fs::read_to_string(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            DocumentFailure::Missing
        } else {
            DocumentFailure::Unreadable
        }
    })?;
    let value: Value = serde_json::from_str(&content).map_err(|_| DocumentFailure::InvalidJson)?;

    let metadata = value
        .get("metadata")
        .and_then(Value::as_object)
        .ok_or(DocumentFailure::InvalidSchema)?;
    let schema = metadata
        .get("schema")
        .and_then(Value::as_str)
        .ok_or(DocumentFailure::InvalidSchema)?;
    let version = metadata
        .get("schema_version")
        .and_then(Value::as_str)
        .ok_or(DocumentFailure::InvalidSchema)?;
    if schema != expected_schema || version != SUPPORTED_SCHEMA_VERSION {
        return Err(DocumentFailure::UnsupportedSchema);
    }

    let schema_value: Value =
        serde_json::from_str(schema_json).map_err(|_| DocumentFailure::InvalidSchema)?;
    let validator = jsonschema::draft202012::options()
        .should_validate_formats(true)
        .build(&schema_value)
        .map_err(|_| DocumentFailure::InvalidSchema)?;
    if !validator.is_valid(&value) {
        return Err(DocumentFailure::InvalidSchema);
    }

    serde_json::from_value(value).map_err(|_| DocumentFailure::InvalidSchema)
}

fn read_project_document(path: &Path) -> Result<ProjectManifest, DocumentFailure> {
    let manifest = read_document::<ProjectManifest>(path, PROJECT_SCHEMA, "mixing-project")?;
    validate_revision_history(&manifest)?;
    Ok(manifest)
}

fn validate_revision_history(manifest: &ProjectManifest) -> Result<(), DocumentFailure> {
    let current = manifest.state.current_revision;
    if current == 0 {
        return if manifest.revisions.is_empty()
            && manifest.state.approved_revision.is_none()
            && manifest.state.delivered_revision.is_none()
        {
            Ok(())
        } else {
            Err(DocumentFailure::InvalidSchema)
        };
    }

    if manifest.revisions.len() != current as usize {
        return Err(DocumentFailure::InvalidSchema);
    }
    let mut numbers = BTreeSet::new();
    let mut ids = BTreeSet::new();
    for revision in &manifest.revisions {
        if !numbers.insert(revision.number) || !ids.insert(revision.revision_id.as_str()) {
            return Err(DocumentFailure::InvalidSchema);
        }
    }
    if !(1..=current).all(|number| numbers.contains(&number)) {
        return Err(DocumentFailure::InvalidSchema);
    }

    for pointer in [
        manifest.state.approved_revision,
        manifest.state.delivered_revision,
    ]
    .into_iter()
    .flatten()
    {
        let Some(revision) = manifest
            .revisions
            .iter()
            .find(|revision| revision.number == pointer)
        else {
            return Err(DocumentFailure::InvalidSchema);
        };
        if revision.approval.approved_at.is_none() || revision.approval.approved_by.is_none() {
            return Err(DocumentFailure::InvalidSchema);
        }
    }
    Ok(())
}

fn directory_entries(path: &Path) -> Result<Vec<PathBuf>, DocumentFailure> {
    let entries = fs::read_dir(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            DocumentFailure::Missing
        } else {
            DocumentFailure::Unreadable
        }
    })?;
    entries
        .map(|entry| {
            entry
                .map(|entry| entry.path())
                .map_err(|_| DocumentFailure::Unreadable)
        })
        .collect()
}

fn is_symlink(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false)
}

fn lower(value: &str) -> String {
    value.to_lowercase()
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Unknown item".to_owned())
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .into_owned()
}

fn issue_for_path(
    root: &Path,
    path: &Path,
    scope: DiscoveryScope,
    code: DiscoveryCode,
    display_name: Option<String>,
    message: &str,
    recovery: &str,
) -> DiscoveryIssue {
    issue(
        scope,
        code,
        display_name,
        Some(relative_path(root, path)),
        message,
        recovery,
    )
}

fn issue(
    scope: DiscoveryScope,
    code: DiscoveryCode,
    display_name: Option<String>,
    relative_path: Option<String>,
    message: &str,
    recovery: &str,
) -> DiscoveryIssue {
    DiscoveryIssue {
        scope,
        code,
        display_name,
        relative_path,
        message: message.to_owned(),
        recovery: recovery.to_owned(),
    }
}

enum DocumentFailure {
    Missing,
    Unreadable,
    InvalidJson,
    InvalidSchema,
    UnsupportedSchema,
}

impl DocumentFailure {
    fn into_issue(
        self,
        root: &Path,
        path: &Path,
        scope: DiscoveryScope,
        display_name: Option<String>,
    ) -> DiscoveryIssue {
        let (code, message, recovery) = match self {
            Self::Missing => (
                if matches!(&scope, DiscoveryScope::Client | DiscoveryScope::Project) {
                    DiscoveryCode::MissingManifest
                } else {
                    DiscoveryCode::NotFound
                },
                "A required JL Mixing file or directory is missing",
                "Restore the item from JL Mixing Automation or remove the incomplete directory.",
            ),
            Self::Unreadable => (
                DiscoveryCode::Unreadable,
                "A JL Mixing file or directory could not be read",
                "Check the item's permissions and try Refresh again.",
            ),
            Self::InvalidJson => (
                DiscoveryCode::InvalidJson,
                "A JL Mixing metadata file contains invalid JSON",
                "Correct or recreate the metadata file with JL Mixing Automation.",
            ),
            Self::InvalidSchema => (
                DiscoveryCode::InvalidSchema,
                "A JL Mixing metadata file does not match its supported schema",
                "Validate or recreate the metadata file with JL Mixing Automation v1.2.0.",
            ),
            Self::UnsupportedSchema => (
                DiscoveryCode::UnsupportedSchema,
                "A JL Mixing metadata file uses an unsupported schema or schema version",
                "Open this workspace with a compatible JL Mixing Studio version.",
            ),
        };
        issue_for_path(root, path, scope, code, display_name, message, recovery)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    const PROJECT: &str = include_str!("../../fixtures/project with spaces/project-manifest.json");

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
        let revision = &snapshot.clients[1].projects[0].revisions[0];
        assert_eq!(revision.number, 1);
        assert_eq!(revision.description, "Initial mix");
        assert_eq!(revision.approved_at, None);
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
        let manifest: ProjectManifest =
            serde_json::from_value(value).expect("project manifest shape");

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
        let manifest: ProjectManifest =
            serde_json::from_value(value).expect("project manifest shape");

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
        let manifest: ProjectManifest =
            serde_json::from_value(value).expect("project manifest shape");

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
}
