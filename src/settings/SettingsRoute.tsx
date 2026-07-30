import type { VersionCheck, WorkspaceSnapshot } from "../types";
import type { ResourceState } from "../AppViews";
import { copy as productCopy } from "../resources/copy";
import type { AppPreferences } from "../AppWorkflowModels";

export function SettingsRoute({ preferences, onChange, workspace, version }: { preferences: AppPreferences; onChange: (value: AppPreferences) => void; workspace: ResourceState<WorkspaceSnapshot>; version: ResourceState<VersionCheck> }) {
  const update = (value: AppPreferences) => {
    localStorage.setItem("jl-mixing-studio.preferences", JSON.stringify(value));
    onChange(value);
  };
  return <section className="planned-route" aria-labelledby="settings-heading"><div className="panel-heading"><div><p className="kicker">{productCopy.settings.kicker}</p><h2 id="settings-heading">{productCopy.settings.title}</h2></div></div>
    <div className="project-detail-grid"><section className="panel"><h3>{productCopy.settings.appearance}</h3><label className="setting-row"><span><strong>{productCopy.settings.compactLayout}</strong><small>{productCopy.settings.compactLayoutHelp}</small></span><input type="checkbox" checked={preferences.compactLayout} onChange={(event) => update({...preferences, compactLayout:event.target.checked})} /></label><label className="setting-row"><span><strong>{productCopy.settings.reduceMotion}</strong><small>{productCopy.settings.reduceMotionHelp}</small></span><input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => update({...preferences, reduceMotion:event.target.checked})} /></label></section>
      <section className="panel"><h3>{productCopy.settings.diagnostics}</h3><dl className="metadata-list"><div><dt>{productCopy.settings.workspace}</dt><dd>{workspace.status === "ready" ? <code>{workspace.value.workspacePath}</code> : workspace.status}</dd></div><div><dt>{productCopy.settings.workspaceStatus}</dt><dd>{workspace.status === "ready" ? workspace.value.status : productCopy.settings.unavailable}</dd></div><div><dt>{productCopy.settings.automation}</dt><dd>{version.status === "ready" ? version.value.message : productCopy.settings.checkUnavailable}</dd></div><div><dt>{productCopy.settings.supportedContract}</dt><dd>JL Mixing Automation 1.3.1</dd></div></dl></section></div>
    <aside className="route-note"><strong>{productCopy.settings.boundary}</strong><span>{productCopy.settings.boundaryPrefix} <code>studio.json</code>, {productCopy.settings.boundarySuffix}</span></aside>
  </section>;
}
