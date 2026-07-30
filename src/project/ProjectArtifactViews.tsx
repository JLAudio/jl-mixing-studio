import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ClientSummary,
  IntakeOperationResult,
  ProjectSummary,
  WorkspaceSnapshot,
} from "../types";
import { FolderControl, type ProjectView, type ResourceState } from "../AppShellViews";
import { copy as productCopy } from "../resources/copy";
import { ProjectWorkflowTabs } from "./ProjectViews";

export function ProjectArtifactsView({ active, client, project, onSelectView }: { active: "reports" | "files" | "metadata"; client: ClientSummary; project: ProjectSummary; onSelectView: (view: ProjectView) => void }) {
  const [report, setReport] = useState<IntakeOperationResult | null>(null);
  useEffect(() => {
    let current = true;
    void invoke<IntakeOperationResult>("get_intake_report", { request: { clientId: client.clientId, projectId: project.projectId } })
      .then((result) => { if (current) setReport(result); })
      .catch(() => { if (current) setReport(null); });
    return () => { current = false; };
  }, [client.clientId, project.projectId]);
  const intake = report?.ok ? report.report : null;
  return <>
    <ProjectWorkflowTabs active={active} onSelect={onSelectView} />
    <section className="directory-toolbar"><div><p className="kicker">{client.clientName}</p><h2>{active === "reports" ? "Project reports" : active === "files" ? "Project files" : "Project metadata"}</h2></div></section>
    {active === "reports" && <div className="project-detail-grid"><section className="panel"><h3>Intake validation report</h3><p>{intake ? `${intake.filesDiscovered} files · ${intake.blockingErrors} blocking errors · ${intake.warnings} warnings` : "No readable intake report is recorded."}</p>{intake && <code>{intake.source}</code>}</section><section className="panel"><h3>Delivery details</h3><p>{project.delivery ? `Revision ${project.delivery.revision} · ${project.delivery.files.length} files · ${project.delivery.method}` : "No delivery package has been recorded yet."}</p>{project.delivery && <code>05_Final_Delivery/delivery-manifest.json</code>}</section></div>}
    {active === "files" && <section className="panel"><div className="table-scroll"><table><thead><tr><th>File</th><th>Source</th><th>Details</th></tr></thead><tbody>{intake?.inventory.map((file) => <tr key={`intake-${file.file}`}><td><code>{file.file}</code></td><td>Intake report</td><td>{file.technicalDetails}</td></tr>)}{project.delivery?.files.map((file) => <tr key={`delivery-${file.path}`}><td><code>{file.path}</code></td><td>Delivery details</td><td>{file.deliverableType.replace(/_/g, " ")} · {file.sizeBytes.toLocaleString()} bytes</td></tr>)}{!intake?.inventory.length && !project.delivery?.files.length && <tr><td colSpan={3}>No files are recorded in the available project reports.</td></tr>}</tbody></table></div></section>}
    {active === "metadata" && <section className="panel"><dl className="metadata-list"><div><dt>Client ID</dt><dd><code>{client.clientId}</code></dd></div><div><dt>{productCopy.projects.projectId}</dt><dd><code>{project.projectId}</code></dd></div><div><dt>Project</dt><dd>{project.projectName}</dd></div><div><dt>{productCopy.projects.tableArtist}</dt><dd>{project.artist}</dd></div><div><dt>Created</dt><dd>{project.createdAt}</dd></div><div><dt>{productCopy.projects.schema}</dt><dd>{project.schemaVersion}</dd></div><div><dt>{productCopy.projects.audio}</dt><dd>{project.sampleRate} Hz · {project.bitDepth}-bit {project.fileFormat}</dd></div><div><dt>Delivery method</dt><dd>{project.deliveryMethod}</dd></div><div><dt>Current / approved / delivered</dt><dd>{project.currentRevision} / {project.approvedRevision ?? "—"} / {project.deliveredRevision ?? "—"}</dd></div></dl></section>}
    <FolderControl location="project" clientId={client.clientId} projectId={project.projectId} />
  </>;
}

export function ReportsRoute({ workspace, onOpenProject }: { workspace: ResourceState<WorkspaceSnapshot>; onOpenProject: (clientId: string, projectId: string) => void }) {
  if (workspace.status !== "ready") return <section className="empty-state"><h2>Loading reports</h2></section>;
  const deliveries = workspace.value.clients.flatMap((client) => client.projects.filter((project) => project.delivery).map((project) => ({ client, project })));
  return <section className="panel"><div className="panel-heading"><div><p className="kicker">Studio reports</p><h2>Reports</h2></div></div><p>Delivery reports are collected here. Intake reports are available from each project’s Reports tab.</p><div className="table-scroll"><table><thead><tr><th>Report</th><th>Project</th><th>Updated</th></tr></thead><tbody>{deliveries.map(({ client, project }) => <tr key={`${client.clientId}-${project.projectId}`}><td>Delivery details</td><td><button className="table-link" type="button" onClick={() => onOpenProject(client.clientId, project.projectId)}>{project.projectName}</button></td><td>{project.delivery!.createdAt}</td></tr>)}{deliveries.length === 0 && <tr><td colSpan={3}>No delivery reports yet.</td></tr>}</tbody></table></div></section>;
}
