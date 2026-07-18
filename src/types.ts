export interface VersionCheck {
  available: boolean;
  supported: boolean;
  clientCreationSupported: boolean;
  projectCreationSupported: boolean;
  intakeValidationSupported: boolean;
  revisionCreationSupported: boolean;
  revisionApprovalSupported: boolean;
  version: string | null;
  message: string;
}

export interface RevisionCreationRequest {
  clientId: string;
  projectId: string;
  description: string | null;
}

export interface RevisionCreationSummary {
  clientId: string;
  projectId: string;
  number: number;
  description: string;
}

export type RevisionOperationCode =
  | "ready"
  | "created"
  | "invalidInput"
  | "automationUnavailable"
  | "unsupportedVersion"
  | "unsupportedPlatform"
  | "workspaceBlocked"
  | "projectUnavailable"
  | "rejected"
  | "uncertain"
  | "failed";

export interface RevisionOperationResult {
  ok: boolean;
  code: RevisionOperationCode;
  message: string;
  revision: RevisionCreationSummary | null;
}

export interface RevisionApprovalRequest {
  clientId: string;
  projectId: string;
  revision: number;
  approvedBy: string;
}

export interface RevisionApprovalSummary {
  clientId: string;
  projectId: string;
  revision: number;
  approvedBy: string;
  approvedAt: string | null;
}

export type ApprovalOperationCode =
  | "ready"
  | "approved"
  | "invalidInput"
  | "automationUnavailable"
  | "unsupportedVersion"
  | "unsupportedPlatform"
  | "workspaceBlocked"
  | "projectUnavailable"
  | "revisionUnavailable"
  | "alreadyApproved"
  | "rejected"
  | "uncertain"
  | "failed";

export interface ApprovalOperationResult {
  ok: boolean;
  code: ApprovalOperationCode;
  message: string;
  approval: RevisionApprovalSummary | null;
}

export interface IntakeRequest {
  clientId: string;
  projectId: string;
}

export interface IntakeInventoryItem {
  file: string;
  sizeBytes: number;
  technicalDetails: string;
}

export interface IntakeReport {
  clientId: string;
  projectId: string;
  source: string;
  filesDiscovered: number;
  blockingErrors: number;
  warnings: number;
  expectedSampleRate: number;
  expectedBitDepth: number;
  enhancedInspectionAvailable: boolean;
  criticalErrors: string[];
  duplicateFilenames: string[];
  formatMismatches: string[];
  unsupportedFiles: string[];
  unavailableChecks: string[];
  inventory: IntakeInventoryItem[];
  recommendations: string[];
}

export type IntakeOperationCode =
  | "notRun"
  | "ready"
  | "validated"
  | "blockingFindings"
  | "invalidInput"
  | "automationUnavailable"
  | "unsupportedVersion"
  | "unsupportedPlatform"
  | "workspaceBlocked"
  | "projectUnavailable"
  | "reportUnavailable"
  | "rejected"
  | "uncertain"
  | "failed";

export interface IntakeOperationResult {
  ok: boolean;
  code: IntakeOperationCode;
  message: string;
  report: IntakeReport | null;
}

export interface ClientCreationRequest {
  clientId: string;
  clientName: string;
  defaultArtist: string | null;
}

export interface ClientCreationSummary {
  clientId: string;
  clientName: string;
  defaultArtist: string | null;
}

export type ClientOperationCode =
  | "ready"
  | "created"
  | "invalidInput"
  | "automationUnavailable"
  | "unsupportedVersion"
  | "unsupportedPlatform"
  | "workspaceBlocked"
  | "collision"
  | "rejected"
  | "failed";

export interface ClientOperationResult {
  ok: boolean;
  code: ClientOperationCode;
  message: string;
  client: ClientCreationSummary | null;
}

export interface ProjectCreationRequest {
  clientId: string;
  projectName: string;
  artist: string | null;
}

export interface ProjectCreationSummary {
  clientId: string;
  projectId: string;
  projectName: string;
  artist: string;
}

export type ProjectOperationCode =
  | "ready"
  | "created"
  | "invalidInput"
  | "automationUnavailable"
  | "unsupportedVersion"
  | "unsupportedPlatform"
  | "workspaceBlocked"
  | "clientUnavailable"
  | "collision"
  | "rejected"
  | "uncertain"
  | "failed";

export interface ProjectOperationResult {
  ok: boolean;
  code: ProjectOperationCode;
  message: string;
  project: ProjectCreationSummary | null;
}

export type WorkspaceStatus =
  | "healthy"
  | "empty"
  | "partial"
  | "unavailable"
  | "invalid";

export interface WorkspaceSnapshot {
  workspacePath: string;
  status: WorkspaceStatus;
  studio: StudioSummary | null;
  counts: WorkspaceCounts;
  clients: ClientSummary[];
  issues: DiscoveryIssue[];
}

export interface StudioSummary {
  studioId: string;
  studioName: string;
  schemaVersion: string;
  createdWith: string;
}

export interface WorkspaceCounts {
  clients: number;
  projects: number;
  issues: number;
}

export interface ClientSummary {
  clientId: string;
  clientName: string;
  defaultArtist: string;
  projects: ProjectSummary[];
}

export interface ProjectSummary {
  projectId: string;
  projectName: string;
  artist: string;
  schemaVersion: string;
  createdWith: string;
  sampleRate: number;
  bitDepth: number;
  fileFormat: string;
  currentRevision: number;
  approvedRevision: number | null;
  deliveredRevision: number | null;
  delivery: DeliverySummary | null;
  revisions: RevisionSummary[];
}

export interface DeliveryFile {
  path: string;
  deliverableType: string;
  sizeBytes: number;
  sha256: string;
}

export interface DeliverySummary {
  documentId: string;
  createdWith: string;
  createdAt: string;
  method: string;
  revision: number;
  revisionId: string;
  description: string;
  approvedAt: string;
  approvedBy: string;
  files: DeliveryFile[];
}

export interface RevisionSummary {
  number: number;
  revisionId: string;
  createdAt: string;
  description: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

export interface DiscoveryIssue {
  scope: "workspace" | "studio" | "client" | "project";
  code:
    | "notFound"
    | "unreadable"
    | "invalidJson"
    | "invalidSchema"
    | "unsupportedSchema"
    | "missingManifest";
  displayName: string | null;
  relativePath: string | null;
  message: string;
  recovery: string;
}
