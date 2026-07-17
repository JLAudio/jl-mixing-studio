export interface VersionCheck {
  available: boolean;
  version: string | null;
  message: string;
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
