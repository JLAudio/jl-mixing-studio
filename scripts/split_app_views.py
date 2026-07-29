from pathlib import Path
import re

source_path = Path("src/AppViews.tsx")
source = source_path.read_text()
marker = "\nexport function ClientsRoute("
if marker not in source:
    raise SystemExit("ClientsRoute boundary not found")

body_start = source.index("export type ResourceState")
boundary = source.index(marker)

shell_header = '''import { type ReactNode, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type {
  ActivityEvent,
  DerivedTask,
  DiscoveryIssue,
  FolderLocation,
  FolderRequest,
  FolderResult,
  VersionCheck,
  WorkspaceSnapshot,
} from "./types";
import appIcon from "../src-tauri/icons/128x128.png";
import { routes, type PrimaryRoute, type RouteDefinition } from "./ui/routes";

'''

project_header = '''import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ClientSummary,
  DeliveryNotesDocument,
  DeliveryNotesRequest,
  DeliveryNotesUpdateRequest,
  IntakeOperationResult,
  IntakeReport,
  ProjectSummary,
  RevisionSummary,
  WorkspaceSnapshot,
} from "./types";
import {
  ContextSearch,
  FolderControl,
  RouteIssues,
  WorkspaceContent,
  safeError,
  type IntakeReportState,
  type ProjectView,
  type ResourceState,
} from "./AppShellViews";

const revisionLabel = (revision: number | null) =>
  revision === null ? "Not set" : `Revision ${revision}`;

'''

shell = shell_header + source[body_start:boundary].rstrip() + "\n"
project = project_header + source[boundary + 1:].lstrip()
barrel = 'export * from "./AppShellViews";\nexport * from "./AppProjectViews";\n'

Path("src/AppShellViews.tsx").write_text(shell)
Path("src/AppProjectViews.tsx").write_text(project)
source_path.write_text(barrel)

original_exports = sorted(re.findall(r"^export (?:function|const|type|interface) ([A-Za-z0-9_]+)", source, re.M))
split_exports = sorted(
    re.findall(r"^export (?:function|const|type|interface) ([A-Za-z0-9_]+)", shell + "\n" + project, re.M)
)
if original_exports != split_exports:
    raise SystemExit(f"export mismatch:\noriginal={original_exports}\nsplit={split_exports}")

for required in ["Dashboard", "ActivityRoute", "ClientsRoute", "ProjectOverview", "IntakeView", "RevisionsView", "DeliveryView", "ReportsRoute"]:
    if required not in split_exports:
        raise SystemExit(f"missing export: {required}")

print(f"preserved {len(original_exports)} exported AppViews symbols")
print(f"AppShellViews.tsx: {len(shell.splitlines())} lines")
print(f"AppProjectViews.tsx: {len(project.splitlines())} lines")
