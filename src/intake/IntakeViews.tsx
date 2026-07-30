import type { ClientSummary, IntakeReport, ProjectSummary } from "../types";
import { FolderControl, type IntakeReportState, type ProjectView } from "../AppShellViews";
import { ProjectWorkflowTabs } from "../project";
import { copy as productCopy } from "../resources/copy";

export function IntakeReportContent({ report, compact = false }: { report: IntakeReport; compact?: boolean }) {
  const findingGroups = [
    ["Critical errors", report.criticalErrors],
    ["Duplicate filenames", report.duplicateFilenames],
    ["Project-format mismatches", report.formatMismatches],
    ["Unsupported or non-audio files", report.unsupportedFiles],
    ["Skipped or unavailable checks", report.unavailableChecks],
  ] as const;
  return (
    <>
      <section className="detail-summary intake-summary" aria-label="Intake summary">
        <article><span>Files</span><strong>{report.filesDiscovered}</strong></article>
        <article><span>Blocking errors</span><strong>{report.blockingErrors}</strong></article>
        <article><span>Warnings</span><strong>{report.warnings}</strong></article>
      </section>
      <p className="intake-format">Expected format: {report.expectedSampleRate / 1000} kHz / {report.expectedBitDepth}-bit · Enhanced inspection {report.enhancedInspectionAvailable ? "available" : "unavailable"}</p>
      {!compact && (
        <>
          <div className="intake-findings">
            {findingGroups.map(([label, findings]) => (
              <section key={label} className="panel">
                <h3>{label}</h3>
                {findings.length > 0 ? <ul>{findings.map((finding) => <li key={finding}>{finding}</li>)}</ul> : <p>None.</p>}
              </section>
            ))}
          </div>
          <section className="panel intake-inventory" aria-labelledby="intake-inventory-heading">
            <div className="panel-heading"><div><p className="kicker">Source inventory</p><h2 id="intake-inventory-heading">{report.inventory.length} inspected {report.inventory.length === 1 ? "file" : "files"}</h2></div></div>
            <div className="table-scroll"><table><thead><tr><th scope="col">File</th><th scope="col">Size</th><th scope="col">Technical details</th></tr></thead><tbody>
              {report.inventory.map((item) => <tr key={item.file}><td><code>{item.file}</code></td><td>{item.sizeBytes.toLocaleString()} bytes</td><td>{item.technicalDetails}</td></tr>)}
              {report.inventory.length === 0 && <tr><td colSpan={3}>No files discovered.</td></tr>}
            </tbody></table></div>
          </section>
          <section className="panel intake-recommendations"><p className="kicker">Preparation recommendations</p><ul>{report.recommendations.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <p className="intake-source">Source: <code>{report.source}</code></p>
        </>
      )}
    </>
  );
}

export function IntakeView({
  client,
  project,
  reportState,
  actionError,
  validationAvailable,
  validationHelp,
  loading,
  onOverview,
  onPreview,
  onRefresh,
  onSelectView,
}: {
  client: ClientSummary;
  project: ProjectSummary;
  reportState: IntakeReportState;
  actionError: string | null;
  validationAvailable: boolean;
  validationHelp: string;
  loading: boolean;
  onOverview: () => void;
  onPreview: () => void;
  onRefresh: () => void;
  onSelectView: (view: ProjectView) => void;
}) {
  const result = reportState.status === "ready" ? reportState.value : null;
  return (
    <>
      <div className="detail-navigation-row"><nav className="breadcrumbs" aria-label={productCopy.common.breadcrumbLabel}><button type="button" onClick={onOverview}>{project.projectName}</button><span aria-hidden="true">/</span><span aria-current="page">Intake</span></nav><button type="button" className="secondary" onClick={onRefresh} disabled={loading}>{loading ? productCopy.common.refreshing : productCopy.common.refresh}</button></div>
      <ProjectWorkflowTabs active="intake" onSelect={onSelectView} />
      <section className="directory-toolbar intake-toolbar" aria-labelledby="intake-heading">
        <div><p className="kicker">{client.clientName}</p><h2 id="intake-heading">Intake validation</h2></div>
        <button type="button" onClick={onPreview} disabled={!validationAvailable || loading}>Preview validation</button>
      </section>
      <p className="action-help directory-help">{validationHelp}</p>
      <FolderControl location="intake" clientId={client.clientId} projectId={project.projectId} label="Open intake folder" />
      {actionError && <div className="notice error" role="alert">{actionError}</div>}
      {(reportState.status === "idle" || reportState.status === "loading") && <section className="empty-state"><h2>Loading intake report</h2><p>Reading the latest intake report for this project.</p></section>}
      {reportState.status === "error" && <section className="notice error" role="alert"><strong>Report unavailable</strong><span>{reportState.message}</span></section>}
      {result && !result.ok && <section className="notice error" role="alert"><strong>Report unavailable</strong><span>{result.message}</span></section>}
      {result?.ok && !result.report && <section className="empty-state"><h2>Intake validation has not been run</h2><p>Preview the intake check before updating the report.</p></section>}
      {result?.ok && result.report && <IntakeReportContent report={result.report} />}
    </>
  );
}
