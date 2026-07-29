from pathlib import Path
import re

app_path = Path("src/App.tsx")
views_path = Path("src/AppViews.tsx")
source = app_path.read_text()

comment_marker = "/**\n * Lets React commit a busy state"
if comment_marker not in source:
    raise SystemExit("App orchestration marker not found")

block_start_marker = "function FolderControl("
block_end_marker = "function DeliveryOptionsDialog("
if block_start_marker not in source or block_end_marker not in source:
    raise SystemExit("View extraction markers not found")

block_start = source.index(block_start_marker)
block_end = source.index(block_end_marker)
view_block = source[block_start:block_end]

# App-only constants live inside the historical presentation block. Keep them
# with orchestration rather than exporting them through the view layer.
view_block = re.sub(
    r'const emptyRevisionForm: RevisionFormValues = \{ description: "" \};\n'
    r'const emptyApprovalForm: ApprovalFormValues = \{ approvedBy: "Client" \};\n\n',
    "",
    view_block,
)
view_block = re.sub(
    r'const clientIdPattern = /\^\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*\$/;\n\n',
    "",
    view_block,
)
view_block = re.sub(
    r'const sameDeliveryPlan = \([\s\S]*?\n  \}\);\n\n(?=function IssueDetail)',
    "",
    view_block,
)

# The error formatter is shared by views and orchestration after the split.
view_block = view_block.replace("const safeError =", "export const safeError =", 1)
# Export presentation components consumed by App.tsx. Exporting internal
# capitalized helpers as well keeps the codemod mechanical and harmless.
view_block = re.sub(r"(?m)^function ([A-Z][A-Za-z0-9_]*)\(", r"export function \1(", view_block)

views_header = '''import { type ReactNode, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type {
  ActivityEvent,
  ClientSummary,
  DeliveryNotesDocument,
  DeliveryNotesRequest,
  DeliveryNotesUpdateRequest,
  DerivedTask,
  DiscoveryIssue,
  FolderLocation,
  FolderRequest,
  FolderResult,
  IntakeOperationResult,
  IntakeReport,
  ProjectSummary,
  RevisionSummary,
  VersionCheck,
  WorkspaceSnapshot,
} from "./types";
import appIcon from "../src-tauri/icons/128x128.png";
import { routes, type PrimaryRoute, type RouteDefinition } from "./ui/routes";

export type ResourceState<T> =
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "error"; message: string };

export type ProjectView =
  | "overview"
  | "intake"
  | "revisions"
  | "delivery"
  | "reports"
  | "files"
  | "metadata";

export type IntakeReportState = { status: "idle" } | ResourceState<IntakeOperationResult>;

'''
views_path.write_text(views_header + view_block.rstrip() + "\n")

# Rebuild App.tsx from its orchestration marker forward. Imports are made
# explicit so unused presentation-only dependencies disappear in one step.
body = source[source.index(comment_marker):]
body = re.sub(r'\ntype ProjectView = [^;]+;\n', "\n", body)
body = re.sub(r'\ntype IntakeReportState = \{ status: "idle" \} \| ResourceState<IntakeOperationResult>;\n', "\n", body)
body = re.sub(
    r'\ntype PrimaryRoute =[\s\S]*?\nconst routes: RouteDefinition\[\] = \[[\s\S]*?\n\];\n',
    "\n",
    body,
)

app_block_start = body.index(block_start_marker)
app_block_end = body.index(block_end_marker)
app_helpers = '''const emptyRevisionForm: RevisionFormValues = { description: "" };
const emptyApprovalForm: ApprovalFormValues = { approvedBy: "Client" };

const clientIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const sameDeliveryPlan = (
  left: DeliveryCreationPreview,
  right: DeliveryCreationPreview,
) =>
  left.clientId === right.clientId &&
  left.projectId === right.projectId &&
  left.projectName === right.projectName &&
  left.currentRevision === right.currentRevision &&
  left.approvedRevision === right.approvedRevision &&
  left.deliveryMethod === right.deliveryMethod &&
  left.replacementMode === right.replacementMode &&
  left.createZip === right.createZip &&
  left.deletions.length === right.deletions.length &&
  left.deletions.every((path, index) => path === right.deletions[index]) &&
  left.selected.length === right.selected.length &&
  left.selected.every((file, index) => {
    const candidate = right.selected[index];
    return candidate &&
      file.sourceName === candidate.sourceName &&
      file.deliverableType === candidate.deliverableType &&
      file.path === candidate.path;
  });

'''
body = body[:app_block_start] + app_helpers + body[app_block_end:]

app_header = '''import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ApprovalOperationResult,
  ClientCreationRequest,
  ClientCreationSummary,
  ClientOperationResult,
  ClientSummary,
  DeliveryCreationPreview,
  DeliveryCreationRequest,
  DeliveryOperationResult,
  IntakeOperationResult,
  IntakeReport,
  IntakeRequest,
  ProjectCreationRequest,
  ProjectCreationSummary,
  ProjectOperationResult,
  ProjectSummary,
  RevisionApprovalRequest,
  RevisionApprovalSummary,
  RevisionCreationRequest,
  RevisionCreationSummary,
  RevisionOperationResult,
  RevisionSummary,
  StudioCreationRequest,
  StudioCreationSummary,
  StudioOperationResult,
  VersionCheck,
  WorkspaceSnapshot,
} from "./types";
import {
  ActivityRoute,
  ClientDetails,
  ClientsRoute,
  Dashboard,
  DeliveryView,
  FolderControl,
  IntakeReportContent,
  IntakeView,
  ProjectArtifactsView,
  ProjectOverview,
  ProjectsRoute,
  ReportsRoute,
  RevisionsView,
  RouteHeader,
  RouteIssues,
  Sidebar,
  TasksRoute,
  safeError,
  type IntakeReportState,
  type ProjectView,
  type ResourceState,
} from "./AppViews";
import { routes, type PrimaryRoute, type RouteDefinition } from "./ui/routes";
import "./App.css";

'''
app_path.write_text(app_header + body)

# This codemod and its workflow are intentionally one-shot. Removing them in
# the generated commit keeps the PR focused on product source changes.
Path("scripts/refactor-app-split.py").unlink(missing_ok=True)
Path(".github/workflows/refactor-app-split.yml").unlink(missing_ok=True)
