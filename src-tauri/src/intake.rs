use std::fs;
use std::path::Path;

use crate::models::{IntakeInventoryItem, IntakeReport, IntakeRequest};

const REPORT_PATH: &str = "00_Admin/Intake_Report.md";
const BEGIN_MARKER: &str = "<!-- BEGIN AUTOMATED SECTION -->";
const END_MARKER: &str = "<!-- END AUTOMATED SECTION -->";
const NOT_RUN: &str = "No intake validation has been run.";
const MAX_REPORT_BYTES: usize = 2 * 1024 * 1024;

#[derive(Debug, PartialEq, Eq)]
pub enum IntakeReportError {
    Missing,
    Unsafe,
    TooLarge,
    Invalid,
}

pub fn read_report(
    project_directory: &Path,
    request: &IntakeRequest,
) -> Result<Option<IntakeReport>, IntakeReportError> {
    let path = project_directory.join(REPORT_PATH);
    let metadata = fs::symlink_metadata(&path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            IntakeReportError::Missing
        } else {
            IntakeReportError::Unsafe
        }
    })?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(IntakeReportError::Unsafe);
    }
    if metadata.len() > MAX_REPORT_BYTES as u64 {
        return Err(IntakeReportError::TooLarge);
    }
    let content = fs::read_to_string(path).map_err(|_| IntakeReportError::Unsafe)?;
    parse_report(&content, request)
}

pub fn parse_report(
    content: &str,
    request: &IntakeRequest,
) -> Result<Option<IntakeReport>, IntakeReportError> {
    if content.len() > MAX_REPORT_BYTES {
        return Err(IntakeReportError::TooLarge);
    }
    let managed = managed_section(content)?;
    if managed.trim() == NOT_RUN {
        return Ok(None);
    }

    let summary = section(managed, "Intake Summary").ok_or(IntakeReportError::Invalid)?;
    let source = summary_field(summary, "Source")?
        .trim_matches('`')
        .to_owned();
    let files_discovered = parse_usize(summary_field(summary, "Files discovered")?)?;
    let blocking_errors = parse_usize(summary_field(summary, "Blocking errors")?)?;
    let warnings = parse_usize(summary_field(summary, "Warnings")?)?;
    let expected_sample_rate = parse_u32(summary_field(summary, "Expected sample rate")?)?;
    let expected_bit_depth = parse_u16(summary_field(summary, "Expected bit depth")?)?;
    let enhanced_inspection_available = match summary_field(summary, "Enhanced inspection")? {
        "available through ffprobe" => true,
        "unavailable" => false,
        _ => return Err(IntakeReportError::Invalid),
    };

    let critical_errors = bullet_section(managed, "Critical Errors")?;
    let duplicate_filenames = bullet_section(managed, "Duplicate Filenames")?;
    let format_mismatches = bullet_section(managed, "Project-Format Mismatches")?;
    let unsupported_files = bullet_section(managed, "Unsupported or Non-Audio Files")?;
    let unavailable_checks = bullet_section(managed, "Skipped or Unavailable Checks")?;
    let inventory = inventory_section(managed)?;
    let recommendations = bullet_section(managed, "Preparation Recommendations")?;

    if files_discovered != inventory.len() || blocking_errors != critical_errors.len() {
        return Err(IntakeReportError::Invalid);
    }

    Ok(Some(IntakeReport {
        client_id: request.client_id.clone(),
        project_id: request.project_id.clone(),
        source,
        files_discovered,
        blocking_errors,
        warnings,
        expected_sample_rate,
        expected_bit_depth,
        enhanced_inspection_available,
        critical_errors,
        duplicate_filenames,
        format_mismatches,
        unsupported_files,
        unavailable_checks,
        inventory,
        recommendations,
    }))
}

fn managed_section(content: &str) -> Result<&str, IntakeReportError> {
    if content.contains(BEGIN_MARKER) || content.contains(END_MARKER) {
        let (_, after_begin) = content
            .split_once(BEGIN_MARKER)
            .ok_or(IntakeReportError::Invalid)?;
        let (managed, after_end) = after_begin
            .split_once(END_MARKER)
            .ok_or(IntakeReportError::Invalid)?;
        if after_end.contains(BEGIN_MARKER) || after_end.contains(END_MARKER) {
            return Err(IntakeReportError::Invalid);
        }
        Ok(managed.trim())
    } else {
        Ok(content.trim())
    }
}

fn section<'a>(content: &'a str, heading: &str) -> Option<&'a str> {
    let marker = format!("## {heading}");
    let (_, rest) = content.split_once(&marker)?;
    let end = rest.find("\n## ").unwrap_or(rest.len());
    Some(rest[..end].trim())
}

fn summary_field<'a>(content: &'a str, label: &str) -> Result<&'a str, IntakeReportError> {
    let prefix = format!("- {label}:");
    content
        .lines()
        .find_map(|line| line.trim().strip_prefix(&prefix).map(str::trim))
        .filter(|value| !value.is_empty())
        .ok_or(IntakeReportError::Invalid)
}

fn bullet_section(content: &str, heading: &str) -> Result<Vec<String>, IntakeReportError> {
    let content = section(content, heading).ok_or(IntakeReportError::Invalid)?;
    let values: Vec<_> = content
        .lines()
        .filter_map(|line| line.trim().strip_prefix("- "))
        .map(str::trim)
        .filter(|value| *value != "None.")
        .map(str::to_owned)
        .collect();
    if values.is_empty() && !content.lines().any(|line| line.trim() == "- None.") {
        return Err(IntakeReportError::Invalid);
    }
    Ok(values)
}

fn inventory_section(content: &str) -> Result<Vec<IntakeInventoryItem>, IntakeReportError> {
    let content = section(content, "Source Inventory").ok_or(IntakeReportError::Invalid)?;
    let mut inventory = Vec::new();
    for line in content.lines().map(str::trim).filter(|line| line.starts_with('|')) {
        if line.starts_with("| File |") || line.starts_with("|---") {
            continue;
        }
        let cells = markdown_cells(line)?;
        if cells.len() != 3 {
            return Err(IntakeReportError::Invalid);
        }
        if cells[0] == "_No files_" {
            continue;
        }
        inventory.push(IntakeInventoryItem {
            file: cells[0].trim_matches('`').replace("\\|", "|"),
            size_bytes: cells[1]
                .parse()
                .map_err(|_| IntakeReportError::Invalid)?,
            technical_details: cells[2].to_owned(),
        });
    }
    Ok(inventory)
}

fn markdown_cells(line: &str) -> Result<Vec<String>, IntakeReportError> {
    if !line.starts_with('|') || !line.ends_with('|') {
        return Err(IntakeReportError::Invalid);
    }
    let mut cells = Vec::new();
    let mut current = String::new();
    let mut escaped = false;
    for character in line[1..line.len() - 1].chars() {
        if escaped {
            current.push('\\');
            current.push(character);
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else if character == '|' {
            cells.push(current.trim().to_owned());
            current.clear();
        } else {
            current.push(character);
        }
    }
    if escaped {
        return Err(IntakeReportError::Invalid);
    }
    cells.push(current.trim().to_owned());
    Ok(cells)
}

fn parse_usize(value: &str) -> Result<usize, IntakeReportError> {
    value.parse().map_err(|_| IntakeReportError::Invalid)
}

fn parse_u32(value: &str) -> Result<u32, IntakeReportError> {
    value.parse().map_err(|_| IntakeReportError::Invalid)
}

fn parse_u16(value: &str) -> Result<u16, IntakeReportError> {
    value.parse().map_err(|_| IntakeReportError::Invalid)
}

#[cfg(test)]
mod tests {
    use super::*;

    const REPORT: &str = r#"## Intake Summary

- Source: `/fixed/project/01_Client_Files/Original_Delivery`
- Files discovered: 2
- Blocking errors: 1
- Warnings: 2
- Expected sample rate: 48000
- Expected bit depth: 24
- Enhanced inspection: available through ffprobe

## Critical Errors

- Unreadable audio file `broken.wav`: invalid data

## Duplicate Filenames

- `one/song.wav`, `two/song.wav`

## Project-Format Mismatches

- None.

## Unsupported or Non-Audio Files

- `notes.txt`

## Skipped or Unavailable Checks

- None.

## Source Inventory

| File | Size (bytes) | Technical details |
|---|---:|---|
| `broken.wav` | 12 | not readable |
| `notes\|mix.txt` | 34 | not inspected |

## Preparation Recommendations

- Resolve blocking errors before preparing `Working_Audio/`.
"#;

    fn request() -> IntakeRequest {
        IntakeRequest {
            client_id: "acme-records".into(),
            project_id: "blue-sky".into(),
        }
    }

    #[test]
    fn recognizes_the_untouched_report_template() {
        let report = format!(
            "# Intake Report\n\n{BEGIN_MARKER}\n{NOT_RUN}\n{END_MARKER}\n"
        );
        assert_eq!(parse_report(&report, &request()), Ok(None));
    }

    #[test]
    fn parses_the_automation_report_contract() {
        let report = parse_report(REPORT, &request()).unwrap().unwrap();
        assert_eq!(report.files_discovered, 2);
        assert_eq!(report.blocking_errors, 1);
        assert_eq!(report.inventory[1].file, "notes|mix.txt");
        assert!(report.enhanced_inspection_available);
    }

    #[test]
    fn rejects_inconsistent_or_unbounded_reports() {
        assert_eq!(
            parse_report(&REPORT.replace("Files discovered: 2", "Files discovered: 3"), &request()),
            Err(IntakeReportError::Invalid)
        );
        assert_eq!(
            parse_report(&"x".repeat(MAX_REPORT_BYTES + 1), &request()),
            Err(IntakeReportError::TooLarge)
        );
    }

    #[test]
    fn rejects_missing_or_unsafe_report_paths() {
        let project = tempfile::tempdir().unwrap();
        assert_eq!(
            read_report(project.path(), &request()),
            Err(IntakeReportError::Missing)
        );

        std::fs::create_dir_all(project.path().join(REPORT_PATH)).unwrap();
        assert_eq!(
            read_report(project.path(), &request()),
            Err(IntakeReportError::Unsafe)
        );
    }
}
