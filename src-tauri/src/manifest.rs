use std::fmt;
#[cfg(test)]
use std::{fs, path::Path};

use crate::models::{ProjectManifest, ProjectSummary};

const SUPPORTED_SCHEMA: &str = "mixing-project";
const SUPPORTED_SCHEMA_VERSION: &str = "1.1.0";

#[derive(Debug, PartialEq, Eq)]
pub enum ManifestError {
    #[cfg(test)]
    ReadFailed,
    InvalidJson,
    UnsupportedSchema(String),
    UnsupportedSchemaVersion(String),
}

impl fmt::Display for ManifestError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            #[cfg(test)]
            Self::ReadFailed => write!(formatter, "The project manifest could not be read"),
            Self::InvalidJson => write!(formatter, "The project manifest contains invalid JSON"),
            Self::UnsupportedSchema(schema) => {
                write!(formatter, "Unsupported manifest schema: {schema}")
            }
            Self::UnsupportedSchemaVersion(version) => {
                write!(formatter, "Unsupported manifest schema version: {version}")
            }
        }
    }
}

#[cfg(test)]
pub fn read_project_manifest(path: &Path) -> Result<ProjectSummary, ManifestError> {
    let content = fs::read_to_string(path).map_err(|_| ManifestError::ReadFailed)?;
    parse_project_manifest(&content)
}

pub fn parse_project_manifest(content: &str) -> Result<ProjectSummary, ManifestError> {
    let manifest: ProjectManifest =
        serde_json::from_str(content).map_err(|_| ManifestError::InvalidJson)?;

    if manifest.metadata.schema != SUPPORTED_SCHEMA {
        return Err(ManifestError::UnsupportedSchema(manifest.metadata.schema));
    }
    if manifest.metadata.schema_version != SUPPORTED_SCHEMA_VERSION {
        return Err(ManifestError::UnsupportedSchemaVersion(
            manifest.metadata.schema_version,
        ));
    }

    Ok(ProjectSummary {
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
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../fixtures/project with spaces/project-manifest.json");

    #[test]
    fn parses_v1_2_project_with_v1_1_schema_identity() {
        let summary = parse_project_manifest(FIXTURE).expect("fixture should be valid");
        assert_eq!(summary.project_name, "Architecture Spike");
        assert_eq!(summary.schema_version, "1.1.0");
        assert_eq!(summary.created_with, "jl-mixing 1.2.0");
        assert_eq!(summary.current_revision, 1);
    }

    #[test]
    fn rejects_invalid_json() {
        assert_eq!(parse_project_manifest("{"), Err(ManifestError::InvalidJson));
    }

    #[test]
    fn rejects_unsupported_schema_version() {
        let changed = FIXTURE.replace(
            "\"schema_version\": \"1.1.0\"",
            "\"schema_version\": \"2.0.0\"",
        );
        assert_eq!(
            parse_project_manifest(&changed),
            Err(ManifestError::UnsupportedSchemaVersion("2.0.0".into()))
        );
    }

    #[test]
    fn reads_path_containing_spaces_without_modifying_file() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let spaced = directory.path().join("project with spaces");
        fs::create_dir(&spaced).expect("fixture directory");
        let path = spaced.join("project-manifest.json");
        fs::write(&path, FIXTURE).expect("fixture file");
        let before = fs::read(&path).expect("fixture before");

        let summary = read_project_manifest(&path).expect("manifest should parse");

        assert_eq!(summary.project_id, "architecture-spike");
        assert_eq!(fs::read(path).expect("fixture after"), before);
    }
}
