export interface VersionCheck {
  available: boolean;
  supported: boolean;
  clientCreationSupported: boolean;
  projectCreationSupported: boolean;
  version: string | null;
  message: string;
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
