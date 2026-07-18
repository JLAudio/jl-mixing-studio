use std::cmp::Ordering;

use chrono::{DateTime, NaiveDate};

use crate::models::{
    ActivityEvent, ActivityEventType, ClientSummary, DerivedTask, DiscoveryIssue, ProjectSummary,
    TaskPriority,
};

pub fn derive_tasks(
    clients: &[ClientSummary],
    issues: &[DiscoveryIssue],
    today: NaiveDate,
) -> Vec<DerivedTask> {
    let mut tasks = Vec::new();
    for (index, issue) in issues.iter().enumerate() {
        tasks.push(DerivedTask {
            id: format!(
                "recovery:{}:{index}",
                issue.relative_path.as_deref().unwrap_or("workspace")
            ),
            priority: TaskPriority::Recovery,
            title: "Resolve workspace data issue".into(),
            reason: issue.message.clone(),
            recommended_action: issue.recovery.clone(),
            client_id: None,
            client_name: issue.display_name.clone(),
            project_id: None,
            project_name: issue.display_name.clone(),
            deadline: None,
        });
    }
    for client in clients {
        for project in &client.projects {
            let aligned = project.approved_revision == Some(project.current_revision)
                && project.delivered_revision == Some(project.current_revision);
            if !aligned {
                if let Some(deadline) = project
                    .deadline
                    .as_deref()
                    .and_then(|value| NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
                {
                    let priority = if deadline < today {
                        TaskPriority::Overdue
                    } else {
                        TaskPriority::Upcoming
                    };
                    let (title, reason) = if priority == TaskPriority::Overdue {
                        ("Review overdue project deadline", "The project deadline has passed and revision state is not fully aligned.")
                    } else {
                        ("Review approaching project deadline", "The project has a scheduled deadline and revision state is not fully aligned.")
                    };
                    tasks.push(project_task(
                        client,
                        project,
                        priority,
                        title,
                        reason,
                        "Review the deadline and current revision, approval, and delivery state.",
                        project.deadline.clone(),
                    ));
                }
            }
            if project.approved_revision.is_some()
                && project.approved_revision != project.delivered_revision
            {
                tasks.push(project_task(
                    client,
                    project,
                    TaskPriority::Delivery,
                    "Create or update delivery",
                    "The approved revision differs from the delivered revision.",
                    "Open Delivery and review the authoritative package state.",
                    None,
                ));
            }
            if project.approved_revision != Some(project.current_revision) {
                tasks.push(project_task(
                    client,
                    project,
                    TaskPriority::Review,
                    "Review current revision",
                    "The current revision differs from the approved revision.",
                    "Open Revisions and review the current revision; this does not imply approval readiness.",
                    None,
                ));
            }
        }
    }
    tasks.sort_by(compare_tasks);
    tasks
}

pub fn derive_activity(clients: &[ClientSummary]) -> Vec<ActivityEvent> {
    let mut events = Vec::new();
    for client in clients {
        events.push(ActivityEvent {
            id: format!("client:{}:created", client.client_id),
            event_type: ActivityEventType::ClientCreated,
            timestamp: client.created_at.clone(),
            client_id: client.client_id.clone(),
            client_name: client.client_name.clone(),
            project_id: None,
            project_name: None,
            revision: None,
            persisted_source: "client metadata.created_at".into(),
        });
        for project in &client.projects {
            events.push(project_event(
                client,
                project,
                ActivityEventType::ProjectCreated,
                &project.created_at,
                None,
                "project metadata.created_at",
            ));
            for revision in &project.revisions {
                events.push(project_event(
                    client,
                    project,
                    ActivityEventType::RevisionCreated,
                    &revision.created_at,
                    Some(revision.number),
                    "revision created_at",
                ));
                if let Some(approved_at) = &revision.approved_at {
                    events.push(project_event(
                        client,
                        project,
                        ActivityEventType::RevisionApproved,
                        approved_at,
                        Some(revision.number),
                        "revision approval.approved_at",
                    ));
                }
            }
            if let Some(delivery) = &project.delivery {
                events.push(project_event(
                    client,
                    project,
                    ActivityEventType::DeliveryCreated,
                    &delivery.created_at,
                    Some(delivery.revision),
                    "delivery metadata.created_at",
                ));
            }
        }
    }
    events.sort_by(compare_activity);
    events
}

fn project_task(
    client: &ClientSummary,
    project: &ProjectSummary,
    priority: TaskPriority,
    title: &str,
    reason: &str,
    action: &str,
    deadline: Option<String>,
) -> DerivedTask {
    DerivedTask {
        id: format!(
            "project:{}:{}:{}",
            client.client_id,
            project.project_id,
            priority_rank(priority)
        ),
        priority,
        title: title.into(),
        reason: reason.into(),
        recommended_action: action.into(),
        client_id: Some(client.client_id.clone()),
        client_name: Some(client.client_name.clone()),
        project_id: Some(project.project_id.clone()),
        project_name: Some(project.project_name.clone()),
        deadline,
    }
}

fn project_event(
    client: &ClientSummary,
    project: &ProjectSummary,
    event_type: ActivityEventType,
    timestamp: &str,
    revision: Option<u32>,
    source: &str,
) -> ActivityEvent {
    ActivityEvent {
        id: format!(
            "project:{}:{}:{}:{}",
            client.client_id,
            project.project_id,
            activity_rank(event_type),
            revision.map_or_else(|| "none".into(), |value| value.to_string())
        ),
        event_type,
        timestamp: timestamp.into(),
        client_id: client.client_id.clone(),
        client_name: client.client_name.clone(),
        project_id: Some(project.project_id.clone()),
        project_name: Some(project.project_name.clone()),
        revision,
        persisted_source: source.into(),
    }
}

fn compare_tasks(left: &DerivedTask, right: &DerivedTask) -> Ordering {
    priority_rank(left.priority)
        .cmp(&priority_rank(right.priority))
        .then_with(|| left.deadline.cmp(&right.deadline))
        .then_with(|| lower(&left.client_name).cmp(&lower(&right.client_name)))
        .then_with(|| lower(&left.project_name).cmp(&lower(&right.project_name)))
        .then_with(|| left.project_id.cmp(&right.project_id))
        .then_with(|| left.id.cmp(&right.id))
}

fn compare_activity(left: &ActivityEvent, right: &ActivityEvent) -> Ordering {
    timestamp_key(&right.timestamp)
        .cmp(&timestamp_key(&left.timestamp))
        .then_with(|| {
            left.client_name
                .to_lowercase()
                .cmp(&right.client_name.to_lowercase())
        })
        .then_with(|| lower(&left.project_name).cmp(&lower(&right.project_name)))
        .then_with(|| activity_rank(left.event_type).cmp(&activity_rank(right.event_type)))
        .then_with(|| left.id.cmp(&right.id))
}

fn timestamp_key(value: &str) -> i64 {
    DateTime::parse_from_rfc3339(value)
        .map(|value| value.timestamp())
        .unwrap_or(i64::MIN)
}
fn lower(value: &Option<String>) -> String {
    value.as_deref().unwrap_or("").to_lowercase()
}
fn priority_rank(value: TaskPriority) -> u8 {
    match value {
        TaskPriority::Recovery => 1,
        TaskPriority::Overdue => 2,
        TaskPriority::Delivery => 3,
        TaskPriority::Upcoming => 4,
        TaskPriority::Review => 5,
    }
}
fn activity_rank(value: ActivityEventType) -> u8 {
    match value {
        ActivityEventType::ClientCreated => 1,
        ActivityEventType::ProjectCreated => 2,
        ActivityEventType::RevisionCreated => 3,
        ActivityEventType::RevisionApproved => 4,
        ActivityEventType::DeliveryCreated => 5,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{DiscoveryCode, DiscoveryScope, RevisionSummary};

    fn project(
        id: &str,
        deadline: Option<&str>,
        current: u32,
        approved: Option<u32>,
        delivered: Option<u32>,
    ) -> ProjectSummary {
        ProjectSummary {
            project_id: id.into(),
            project_name: id.into(),
            artist: "Artist".into(),
            schema_version: "1.1.0".into(),
            created_with: "jl-mixing 1.2.0".into(),
            created_at: "2026-07-01T12:00:00Z".into(),
            deadline: deadline.map(str::to_owned),
            sample_rate: 48_000,
            bit_depth: 24,
            file_format: "WAV".into(),
            delivery_method: "Download".into(),
            current_revision: current,
            approved_revision: approved,
            delivered_revision: delivered,
            delivery: None,
            revisions: vec![RevisionSummary {
                number: 1,
                revision_id: format!("revision-{id}"),
                created_at: "2026-07-02T12:00:00Z".into(),
                description: "Initial mix".into(),
                approved_at: approved.map(|_| "2026-07-03T12:00:00Z".into()),
                approved_by: approved.map(|_| "Client".into()),
            }],
        }
    }
    fn client(projects: Vec<ProjectSummary>) -> ClientSummary {
        ClientSummary {
            client_id: "client".into(),
            client_name: "Client".into(),
            created_at: "2026-06-30T12:00:00Z".into(),
            default_artist: "Artist".into(),
            projects,
        }
    }

    #[test]
    fn ranks_conditions_and_omits_aligned_deadlines() {
        let issue = DiscoveryIssue {
            scope: DiscoveryScope::Project,
            code: DiscoveryCode::InvalidJson,
            display_name: Some("Broken".into()),
            relative_path: Some("broken.json".into()),
            message: "Invalid".into(),
            recovery: "Repair".into(),
        };
        let tasks = derive_tasks(
            &[client(vec![
                project("overdue", Some("2026-07-01"), 2, Some(1), None),
                project("aligned", Some("2026-07-01"), 1, Some(1), Some(1)),
            ])],
            &[issue],
            NaiveDate::from_ymd_opt(2026, 7, 18).unwrap(),
        );
        assert_eq!(tasks[0].priority, TaskPriority::Recovery);
        assert_eq!(tasks[1].priority, TaskPriority::Overdue);
        assert!(!tasks
            .iter()
            .any(|task| task.project_id.as_deref() == Some("aligned")));
    }

    #[test]
    fn sorts_activity_newest_first() {
        let events = derive_activity(&[client(vec![project("project", None, 1, Some(1), None)])]);
        assert!(events.windows(2).all(|pair| {
            timestamp_key(&pair[0].timestamp) >= timestamp_key(&pair[1].timestamp)
        }));
        assert!(events
            .iter()
            .any(|event| event.event_type == ActivityEventType::RevisionApproved));
    }
}
