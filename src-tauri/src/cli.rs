#[cfg(test)]
use std::env;
use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

#[cfg(test)]
use crate::automation_api::{automation_subprocess_path, resolve_command_with_path};
use crate::automation_api::{resolve_command, ProcessResult, ProcessRunner, SystemProcessRunner};
use crate::models::{
    ApprovalOperationCode, ApprovalOperationResult, ClientCreationRequest, ClientCreationSummary,
    ClientOperationCode, ClientOperationResult, DeliveryCreationPreview, DeliveryCreationRequest,
    DeliveryOperationCode, DeliveryOperationResult, ExcludedDeliveryFile, IntakeOperationCode,
    IntakeOperationResult, IntakeRequest, PlannedDeliveryFile, ProjectCreationRequest,
    ProjectCreationSummary, ProjectOperationCode, ProjectOperationResult, RevisionApprovalRequest,
    RevisionApprovalSummary, RevisionCreationRequest, RevisionCreationSummary,
    RevisionOperationCode, RevisionOperationResult, StudioCreationRequest, StudioCreationSummary,
    StudioOperationCode, StudioOperationResult, VersionCheck,
};
use crate::{intake, intake::IntakeReportError};

const CLIENT_EXECUTABLE: &str = "new-client";
const STUDIO_EXECUTABLE: &str = "new-studio";
const PROJECT_EXECUTABLE: &str = "new-mix";
const INTAKE_EXECUTABLE: &str = "validate-intake";
const REVISION_EXECUTABLE: &str = "new-revision";
const APPROVAL_EXECUTABLE: &str = "approve-mix";
const DELIVERY_EXECUTABLE: &str = "create-delivery";
const VERSION_FILE: &str = "VERSION";
const SUPPORTED_VERSION: &str = "1.3.1";
const MAX_VERSION_FILE_BYTES: usize = 64;
const MAX_PROCESS_MESSAGE_CHARS: usize = 1_000;
