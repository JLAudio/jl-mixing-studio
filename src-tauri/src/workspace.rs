use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;
use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::derived::{derive_activity, derive_tasks};
use crate::models::{
    ClientDocument, ClientSummary, DeliveryManifest, DeliverySummary, DiscoveryCode,
    DiscoveryIssue, DiscoveryScope, ProjectManifest, ProjectSummary, RevisionSummary,
    StudioDocument, StudioSummary, WorkspaceCounts, WorkspaceSnapshot, WorkspaceStatus,
};

const STUDIO_SCHEMA: &str = include_str!("../../schemas/jl-mixing-v1.2.0/studio.schema.json");
const CLIENT_SCHEMA: &str = include_str!("../../schemas/jl-mixing-v1.2.0/client.schema.json");
const PROJECT_SCHEMA: &str =
    include_str!("../../schemas/jl-mixing-v1.2.0/project-manifest.schema.json");
const DELIVERY_SCHEMA: &str =
    include_str!("../../schemas/jl-mixing-v1.2.0/delivery-manifest.schema.json");
const SUPPORTED_SCHEMA_VERSION: &str = "1.1.0";

pub fn discover_workspace_at(root: &Path) -> WorkspaceSnapshot {
    let workspace_path = root.to_string_lossy().into_owned();
    if !root.is_dir() {
        return build_snapshot(
            workspace_path,
            WorkspaceStatus::Unavailable,
            None,
            Vec::new(),
            vec![issue(
                DiscoveryScope::Workspace,
                DiscoveryCode::NotFound,
                None,
                None,
                "The default JL Mixing workspace was not found",
                "Install JL Mixing Automation and run new-studio to create ~/Music/Mixes.",
            )],
        );
    }

    let studio_path = root.join("Studio").join("studio.json");
    let studio_document =
        match read_document::<StudioDocument>(&studio_path, STUDIO_SCHEMA, "mixing-studio") {
            Ok(document) => document,
            Err(failure) => {
                let problem = failure.into_issue(root, &studio_path, DiscoveryScope::Studio, None);
                return build_snapshot(
                    workspace_path,
                    WorkspaceStatus::Invalid,
                    None,
                    Vec::new(),
                    vec![problem],
                );
            }
        };

    let studio = StudioSummary {
        studio_id: studio_document.studio_id,
        studio_name: studio_document.studio_name,
        root_path: studio_document.root_path,
        schema_version: studio_document.metadata.schema_version,
        created_with: studio_document.metadata.created_with,
        created_at: studio_document.metadata.created_at,
        mix_engineer: studio_document.defaults.mix_engineer,
        sample_rate: studio_document.defaults.audio.sample_rate,
        bit_depth: studio_document.defaults.audio.bit_depth,
        file_format: studio_document.defaults.audio.file_format,
        delivery_method: studio_document.defaults.delivery.method,
        requested_deliverables: studio_document.defaults.delivery.requested_deliverables,
        change_directory_after_create: studio_document.cli.change_directory_after_create,
    };

    let clients_path = root.join("Clients");
    let entries = match directory_entries(&clients_path) {
        Ok(entries) => entries,
        Err(failure) => {
            let problem = failure.into_issue(root, &clients_path, DiscoveryScope::Workspace, None);
            return build_snapshot(
                workspace_path,
                WorkspaceStatus::Invalid,
                Some(studio),
                Vec::new(),
                vec![problem],
            );
        }
    };

    let mut discovered_clients = Vec::new();
    let mut issues = Vec::new();
    for client_path in entries {
        if let Some(client) = discover_client(root, &client_path, &mut issues) {
            discovered_clients.push(client);
        }
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
    let status = if !issues.is_empty() {
        WorkspaceStatus::Partial
    } else if clients.is_empty() {
        WorkspaceStatus::Empty
    } else {
        WorkspaceStatus::Healthy
    };

    build_snapshot(workspace_path, status, Some(studio), clients, issues)
}

/// Discovers one client without letting a malformed sibling invalidate the whole workspace.
/// Symlinked directories are deliberately not followed so discovery cannot escape the
/// workspace tree through a filesystem alias.
fn discover_client(
    root: &Path,
    client_path: &Path,
    issues: &mut Vec<DiscoveryIssue>,
) -> Option<(ClientSummary, String)> {
    if !client_path.is_dir() {
        return None;
    }
    if is_symlink(client_path) {
        issues.push(issue_for_path(
            root,
            client_path,
            DiscoveryScope::Client,
            DiscoveryCode::Unreadable,
            Some(file_name(client_path)),
            "Symbolic-link client directories are not inspected",
            "Replace the symbolic link with a client directory inside the workspace.",
        ));
        return None;
    }

    let client_file = client_path.join("client.json");
    let client = match read_document::<ClientDocument>(&client_file, CLIENT_SCHEMA, "mixing-client")
    {
        Ok(client) => client,
        Err(failure) => {
            issues.push(failure.into_issue(
                root,
                &client_file,
                DiscoveryScope::Client,
                Some(file_name(client_path)),
            ));
            return None;
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
        if let Some(project) = discover_project(root, &project_path, &client, issues) {
            projects_with_paths.push(project);
        }
    }
    projects_with_paths.sort_by(|left, right| {
        lower(&left.0.project_name)
            .cmp(&lower(&right.0.project_name))
            .then_with(|| left.0.project_id.cmp(&right.0.project_id))
            .then_with(|| left.1.cmp(&right.1))
    });

    Some((
        ClientSummary {
            client_id: client.client_id,
            client_name: client.client_name,
            created_at: client._metadata.created_at,
            default_artist: client.defaults.artist,
            projects: projects_with_paths
                .into_iter()
                .map(|(project, _)| project)
                .collect(),
        },
        relative_path(root, client_path),
    ))
}

/// Discovers one project independently so a corrupt project is reported while valid
/// siblings remain usable in a partial workspace snapshot.
fn discover_project(
    root: &Path,
    project_path: &Path,
    client: &ClientDocument,
    issues: &mut Vec<DiscoveryIssue>,
) -> Option<(ProjectSummary, String)> {
    if !project_path.is_dir() {
        return None;
    }
    if is_symlink(project_path) {
        issues.push(issue_for_path(
            root,
            project_path,
            DiscoveryScope::Project,
            DiscoveryCode::Unreadable,
            Some(file_name(project_path)),
            "Symbolic-link project directories are not inspected",
            "Replace the symbolic link with a project directory inside the workspace.",
        ));
        return None;
    }

    let manifest_path = project_path.join("00_Admin").join("project-manifest.json");
    let manifest = match read_project_document(&manifest_path) {
        Ok(manifest) => manifest,
        Err(failure) => {
            issues.push(failure.into_issue(
                root,
                &manifest_path,
                DiscoveryScope::Project,
                Some(file_name(project_path)),
            ));
            return None;
        }
    };
    let delivery_path = project_path
        .join("05_Final_Delivery")
        .join("delivery-manifest.json");
    let delivery = match read_delivery_summary(&delivery_path, &manifest, client) {
        Ok(delivery) => delivery,
        Err(failure) => {
            issues.push(failure.into_issue(
                root,
                &delivery_path,
                DiscoveryScope::Project,
                Some(manifest.project_name.clone()),
            ));
            return None;
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
        created_at: manifest.metadata.created_at,
        deadline: manifest.schedule.deadline,
        sample_rate: manifest.audio.sample_rate,
        bit_depth: manifest.audio.bit_depth,
        file_format: manifest.audio.file_format,
        delivery_method: manifest.delivery.method,
        current_revision: manifest.state.current_revision,
        approved_revision: manifest.state.approved_revision,
        delivered_revision: manifest.state.delivered_revision,
        delivery,
        revisions,
    };
    Some((summary, relative_path(root, project_path)))
}

fn build_snapshot(
    workspace_path: String,
    status: WorkspaceStatus,
    studio: Option<StudioSummary>,
    clients: Vec<ClientSummary>,
    issues: Vec<DiscoveryIssue>,
) -> WorkspaceSnapshot {
    let project_count = clients.iter().map(|client| client.projects.len()).sum();
    let tasks = derive_tasks(&clients, &issues, Local::now().date_naive());
    let activity = derive_activity(&clients);
    WorkspaceSnapshot {
        workspace_path,
        status,
        studio,
        counts: WorkspaceCounts {
            clients: clients.len(),
            projects: project_count,
            issues: issues.len(),
        },
        clients,
        issues,
        tasks,
        activity,
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

fn read_delivery_summary(
    path: &Path,
    project: &ProjectManifest,
    client: &ClientDocument,
) -> Result<Option<DeliverySummary>, DocumentFailure> {
    if is_symlink(path) || path.parent().is_some_and(is_symlink) {
        return Err(DocumentFailure::Unreadable);
    }
    let exists = path.is_file();
    if !exists && project.state.delivered_revision.is_none() {
        return Ok(None);
    }
    if !exists || project.state.delivered_revision.is_none() {
        return Err(DocumentFailure::InvalidSchema);
    }
    let delivery = read_document::<DeliveryManifest>(path, DELIVERY_SCHEMA, "mixing-delivery")?;
    let delivered = project.state.delivered_revision.unwrap();
    let revision = project
        .revisions
        .iter()
        .find(|revision| revision.number == delivered)
        .ok_or(DocumentFailure::InvalidSchema)?;
    if delivery.project.project_document_id != project.metadata.document_id
        || delivery.project.project_id != project.project_id
        || delivery.project.project_name != project.project_name
        || delivery.client.client_document_id != client._metadata.document_id
        || delivery.client.client_id != client.client_id
        || delivery.revision.number != delivered
        || delivery.revision.revision_id != revision.revision_id
        || delivery.revision.description != revision.description
        || delivery.delivery.method != project.delivery.method
    {
        return Err(DocumentFailure::InvalidSchema);
    }
    let mut paths = BTreeSet::new();
    if !delivery
        .files
        .iter()
        .all(|file| paths.insert(file.path.as_str()))
    {
        return Err(DocumentFailure::InvalidSchema);
    }
    Ok(Some(DeliverySummary {
        document_id: delivery.metadata.document_id,
        created_with: delivery.metadata.created_with,
        created_at: delivery.metadata.created_at,
        method: delivery.delivery.method,
        revision: delivery.revision.number,
        revision_id: delivery.revision.revision_id,
        description: delivery.revision.description,
        approved_at: delivery.revision.approval.approved_at,
        approved_by: delivery.revision.approval.approved_by,
        files: delivery.files,
    }))
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
mod workspace_tests;
