from pathlib import Path
import re

# Capability gating: project creation requires the base operation plus the additive
# effective-artist capability so API 1.0 providers that predate the extension
# degrade cleanly instead of losing inherited artist behavior.
api = Path('src-tauri/src/automation_api.rs')
s = api.read_text()
old = 'project_creation_supported: platform_supported && has("project.create"),'
new = 'project_creation_supported: platform_supported\n            && has("project.create")\n            && has("project.create.effective_artist"),'
if old not in s:
    raise SystemExit('project capability gate not found')
s = s.replace(old, new, 1)
s = s.replace(
    '"capabilities":["system.info","client.create","project.create","revision.create","intake.validate","revision.approve","delivery.create"]',
    '"capabilities":["system.info","client.create","project.create","project.create.effective_artist","revision.create","intake.validate","revision.approve","delivery.create"]',
    1,
)
api.write_text(s)

cli = Path('src-tauri/src/cli.rs')
s = cli.read_text()
s = s.replace('const PROJECT_EXECUTABLE: &str = "new-mix";\n', '', 1)

run_pattern = re.compile(r'(?ms)^fn run_project_operation<R: ProcessRunner>\(.*?^}\n\n(?=fn run_intake_operation)')
if not run_pattern.search(s):
    raise SystemExit('run_project_operation block not found')
run_replacement = r'''fn run_project_operation<R: ProcessRunner>(
    home: &Path,
    client_directory: &Path,
    request: ProjectCreationRequest,
    operation: ProjectOperation,
    runner: &R,
) -> ProjectOperationResult {
    let request = match normalize_project_request(request) {
        Ok(request) => request,
        Err(message) => {
            return blocked_project_operation(ProjectOperationCode::InvalidInput, &message)
        }
    };

    let version = check_version_with_runner(home, runner);
    if !version.available {
        return blocked_project_operation(
            ProjectOperationCode::AutomationUnavailable,
            &version.message,
        );
    }
    if !version.supported {
        return blocked_project_operation(
            ProjectOperationCode::UnsupportedVersion,
            &version.message,
        );
    }
    if !version.project_creation_supported {
        return blocked_project_operation(
            ProjectOperationCode::Rejected,
            "JL Mixing Automation does not advertise the project.create effective-artist capability required by Studio",
        );
    }

    let arguments = project_arguments(&request, operation);
    match invoke_api(
        home,
        "project.create",
        &arguments,
        Some(client_directory),
        runner,
    ) {
        Ok(response)
            if matches!(
                (operation, response.status),
                (ProjectOperation::Preflight, ApiStatus::Planned)
                    | (ProjectOperation::Create, ApiStatus::Success)
            ) =>
        {
            let Some(project) = project_summary_from_api(&response.data, &request) else {
                return blocked_project_operation(
                    match operation {
                        ProjectOperation::Preflight => ProjectOperationCode::Failed,
                        ProjectOperation::Create => ProjectOperationCode::Uncertain,
                    },
                    match operation {
                        ProjectOperation::Preflight => {
                            "The JL Mixing Automation project preview could not be verified"
                        }
                        ProjectOperation::Create => {
                            "JL Mixing Automation reported success, but the created project identity could not be verified. The operation may have completed."
                        }
                    },
                );
            };
            ProjectOperationResult {
                ok: true,
                code: match operation {
                    ProjectOperation::Preflight => ProjectOperationCode::Ready,
                    ProjectOperation::Create => ProjectOperationCode::Created,
                },
                message: match operation {
                    ProjectOperation::Preflight => "Preflight passed. No changes were made.",
                    ProjectOperation::Create => "Project created successfully.",
                }
                .to_owned(),
                project: Some(project),
            }
        }
        Ok(response) => rejected_project_api_response(response),
        Err(ApiCallError::Unavailable) => blocked_project_operation(
            ProjectOperationCode::AutomationUnavailable,
            "JL Mixing Automation was not found in its default install location or on PATH",
        ),
        Err(ApiCallError::IncompatibleVersion(version)) => blocked_project_operation(
            ProjectOperationCode::UnsupportedVersion,
            &format!(
                "JL Mixing Automation returned API {}; Studio requires Automation API 1.0",
                version
            ),
        ),
        Err(error) => blocked_project_operation(
            match operation {
                ProjectOperation::Preflight => ProjectOperationCode::Failed,
                ProjectOperation::Create => ProjectOperationCode::Uncertain,
            },
            &error.message(),
        ),
    }
}

fn project_summary_from_api(
    data: &serde_json::Value,
    request: &ProjectCreationRequest,
) -> Option<ProjectCreationSummary> {
    let project = data.get("project")?;
    let project_id = project.get("id")?.as_str()?;
    let project_name = project.get("name")?.as_str()?;
    let artist = project.get("artist")?.as_str()?;
    let client_id = data
        .get("client")?
        .get("id")?
        .as_str()?;

    if !is_valid_client_id(project_id)
        || project_name != request.project_name
        || artist.trim().is_empty()
        || client_id != request.client_id
    {
        return None;
    }

    Some(ProjectCreationSummary {
        client_id: request.client_id.clone(),
        project_id: project_id.to_owned(),
        project_name: request.project_name.clone(),
        artist: artist.to_owned(),
    })
}

fn rejected_project_api_response(
    response: crate::automation_api::ApiResponse,
) -> ProjectOperationResult {
    let error = response.errors.first();
    let collision = error
        .map(|item| item.code == "PROJECT_ALREADY_EXISTS")
        .unwrap_or(false);
    let message = error.map(|item| item.message.clone()).unwrap_or_else(|| {
        format!(
            "JL Mixing Automation returned unexpected status {:?} for project.create",
            response.status
        )
    });
    ProjectOperationResult {
        ok: false,
        code: if collision {
            ProjectOperationCode::Collision
        } else {
            ProjectOperationCode::Rejected
        },
        message,
        project: None,
    }
}

'''
s = run_pattern.sub(run_replacement, s, count=1)

arg_pattern = re.compile(r'(?ms)^fn project_arguments\(.*?^}\n\n(?=fn revision_arguments)')
if not arg_pattern.search(s):
    raise SystemExit('project_arguments block not found')
arg_replacement = r'''fn project_arguments(request: &ProjectCreationRequest, operation: ProjectOperation) -> Vec<String> {
    let mut arguments = vec![
        "project".into(),
        "create".into(),
        request.project_name.clone(),
        "--json".into(),
    ];
    if let Some(artist) = &request.artist {
        arguments.push("--artist".into());
        arguments.push(artist.clone());
    }
    if matches!(operation, ProjectOperation::Preflight) {
        arguments.push("--dry-run".into());
    }
    arguments
}

'''
s = arg_pattern.sub(arg_replacement, s, count=1)

parse_pattern = re.compile(r'(?ms)^fn parse_project_preview\(.*?^}\n\n(?=fn parse_revision_output)')
if not parse_pattern.search(s):
    raise SystemExit('parse_project_preview block not found')
s = parse_pattern.sub('', s, count=1)

reject_pattern = re.compile(r'(?ms)^fn rejected_project_operation\(.*?^}\n\n(?=fn check_version_with_runner)')
if not reject_pattern.search(s):
    raise SystemExit('legacy rejected_project_operation block not found')
s = reject_pattern.sub('', s, count=1)

# Test fixture migration.
s = s.replace('            PROJECT_EXECUTABLE,\n', '', 1)
project_output_pattern = re.compile(r'(?ms)^    fn project_output\(.*?^    }\n\n(?=    fn intake_request)')
if not project_output_pattern.search(s):
    raise SystemExit('project_output helper not found')
project_helpers = r'''    fn project_api_response(status: &str, artist: &str) -> io::Result<ProcessResult> {
        success(&format!(
            r#"{{"api_version":"1.0","operation":"project.create","status":"{}","data":{{"project":{{"id":"blue-sky","name":"Blue Sky","artist":"{}","path":"/fixed/client/Projects/Blue Sky"}},"client":{{"id":"acme-records","path":"/fixed/client"}},"workspace_path":"/fixed/workspace"}},"warnings":[],"errors":[]}}"#,
            status, artist
        ))
    }

    fn project_api_error(code: &str, message: &str) -> io::Result<ProcessResult> {
        Ok(ProcessResult {
            success: false,
            exit_code: Some(5),
            stdout: format!(
                r#"{{"api_version":"1.0","operation":"project.create","status":"blocked","data":{{}},"warnings":[],"errors":[{{"code":"{}","message":"{}","details":{{"exit_code":5}},"retryable":false}}]}}"#,
                code, message
            ),
            stderr: String::new(),
        })
    }

'''
s = project_output_pattern.sub(project_helpers, s, count=1)

s = s.replace(
    'success(&project_output("blue-sky", "The Artist"))',
    'project_api_response("planned", "The Artist")',
    1,
)
s = s.replace('home.path().join(".local/bin/new-mix")', 'home.path().join(".local/bin/jl-mixing")', 1)
old_preflight_args = '''            vec![
                "--project",
                "Blue Sky",
                "--artist",
                "The Artist",
                "--dry-run"
            ]'''
new_preflight_args = '''            vec![
                "project",
                "create",
                "Blue Sky",
                "--json",
                "--artist",
                "The Artist",
                "--dry-run"
            ]'''
if old_preflight_args not in s:
    raise SystemExit('project preflight args assertion not found')
s = s.replace(old_preflight_args, new_preflight_args, 1)

s = s.replace(
    'success(&project_output("blue-sky", "Inherited Artist"))',
    'project_api_response("success", "Inherited Artist")',
    1,
)
s = s.replace(
    'vec!["--project", "Blue Sky", "--no-cd"]',
    'vec!["project", "create", "Blue Sky", "--json"]',
    1,
)
s = s.replace(
    'failure(4, "Project destination already exists")',
    'project_api_error("PROJECT_ALREADY_EXISTS", "Project destination already exists")',
    1,
)

# The identity-verification test now feeds structurally valid API JSON that omits
# the effective artist, proving Studio treats an incomplete successful response
# as uncertain rather than inventing a value.
old = 'let runner = FakeRunner::new(vec![success("help"), success("Project created")]);'
new = r'''let runner = FakeRunner::new(vec![
            success("help"),
            success(r#"{"api_version":"1.0","operation":"project.create","status":"success","data":{"project":{"id":"blue-sky","name":"Blue Sky","path":"/fixed/client/Projects/Blue Sky"},"client":{"id":"acme-records","path":"/fixed/client"}},"warnings":[],"errors":[]}"#),
        ]);'''
if old not in s:
    raise SystemExit('project incomplete identity test fixture not found')
s = s.replace(old, new, 1)

cli.write_text(s)
