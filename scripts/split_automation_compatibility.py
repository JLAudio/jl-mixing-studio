from pathlib import Path

path = Path('src-tauri/src/automation_api.rs')
text = path.read_text()
start = text.index('pub(crate) fn check_automation_compatibility')
end = text.index('\nfn unavailable_version', start)
replacement = r'''pub(crate) fn check_automation_compatibility<R: ProcessRunner>(
    home: &Path,
    runner: &R,
) -> VersionCheck {
    let discovery = match load_automation_discovery(home, runner) {
        Ok(discovery) => discovery,
        Err(result) => return result,
    };
    let (api_version, application, capabilities) = match validate_discovery(discovery) {
        Ok(validated) => validated,
        Err(result) => return result,
    };
    compatibility_result(&api_version, &application, &capabilities)
}

fn load_automation_discovery<R: ProcessRunner>(
    home: &Path,
    runner: &R,
) -> Result<DiscoveryDocument, VersionCheck> {
    let Some(executable) = resolve_command(home, AUTOMATION_EXECUTABLE) else {
        return Err(unavailable_version(
            "JL Mixing Automation was not found in its default install location or on PATH",
        ));
    };

    let arguments = vec!["system-info".to_owned(), "--json".to_owned()];
    let output = match runner.run(&executable, &arguments, None) {
        Ok(output) if output.success => output,
        Ok(output) => {
            return Err(unavailable_version(&format!(
                "JL Mixing Automation discovery failed with exit code {}",
                output
                    .exit_code
                    .map_or_else(|| "unknown".into(), |code| code.to_string())
            )))
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Err(unavailable_version(
                "JL Mixing Automation was not found in its default install location or on PATH",
            ))
        }
        Err(_) => {
            return Err(unavailable_version(
                "JL Mixing Automation discovery could not be started",
            ))
        }
    };

    serde_json::from_str(output.stdout.trim()).map_err(|_| {
        unavailable_version("JL Mixing Automation returned a malformed discovery response")
    })
}

fn validate_discovery(
    discovery: DiscoveryDocument,
) -> Result<(String, DiscoveryApplication, Vec<String>), VersionCheck> {
    let Some(api_version) = discovery
        .api_version
        .filter(|value| !value.trim().is_empty())
    else {
        return Err(unavailable_version(
            "JL Mixing Automation did not declare an Automation API version",
        ));
    };

    let Some(application) = discovery.application else {
        return Err(unavailable_version(
            "JL Mixing Automation discovery response did not identify the provider application",
        ));
    };
    if application.name != AUTOMATION_EXECUTABLE || application.version.trim().is_empty() {
        return Err(unavailable_version(
            "JL Mixing Automation discovery response did not identify a valid provider application",
        ));
    }

    let Some(capabilities) = discovery.capabilities else {
        return Err(unavailable_version(
            "JL Mixing Automation discovery response did not declare provider capabilities",
        ));
    };

    Ok((api_version, application, capabilities))
}

fn compatibility_result(
    api_version: &str,
    application: &DiscoveryApplication,
    capabilities: &[String],
) -> VersionCheck {
    if api_version != SUPPORTED_API_VERSION {
        return VersionCheck {
            available: true,
            supported: false,
            studio_creation_supported: false,
            client_creation_supported: false,
            project_creation_supported: false,
            intake_validation_supported: false,
            revision_creation_supported: false,
            revision_approval_supported: false,
            delivery_creation_supported: false,
            version: Some(application.version.clone()),
            message: format!(
                "JL Mixing Automation {} exposes API {}; Studio requires Automation API {}",
                application.version, api_version, SUPPORTED_API_VERSION
            ),
        };
    }

    let platform_supported = !cfg!(target_os = "windows");
    let has = |capability: &str| capabilities.iter().any(|item| item == capability);

    VersionCheck {
        available: true,
        supported: true,
        // Studio workspace creation is not yet an Automation API 1.0 capability. Preserve the
        // existing platform gate while the API-backed workflows migrate independently.
        studio_creation_supported: platform_supported,
        client_creation_supported: platform_supported && has("client.create"),
        project_creation_supported: platform_supported
            && has("project.create")
            && has("project.create.artist"),
        intake_validation_supported: platform_supported
            && has("intake.validate")
            && has("intake.validate.report"),
        revision_creation_supported: platform_supported
            && has("revision.create")
            && has("revision.create.description"),
        revision_approval_supported: platform_supported && has("revision.approve"),
        delivery_creation_supported: platform_supported && has("delivery.create"),
        version: Some(application.version.clone()),
        message: format!(
            "JL Mixing Automation {} detected with compatible Automation API {}",
            application.version, api_version
        ),
    }
}
'''
path.write_text(text[:start] + replacement + text[end:])
