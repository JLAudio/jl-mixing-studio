import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

export interface SystemInfo { operatingSystem: string; architecture: string; }
export interface VersionCheck { available: boolean; version: string | null; message: string; }
export interface ProjectSummary {
  projectId: string; projectName: string; artist: string; schemaVersion: string;
  createdWith: string; sampleRate: number; bitDepth: number; fileFormat: string;
  currentRevision: number; approvedRevision: number | null; deliveredRevision: number | null;
}

type LoadState = { status: "loading" } | {
  status: "ready"; system: SystemInfo; version: VersionCheck; project: ProjectSummary;
} | { status: "error"; message: string };

const formatRevision = (revision: number | null) => revision === null ? "Not set" : `Revision ${revision}`;

export default function App() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    Promise.all([
      invoke<SystemInfo>("get_system_info"),
      invoke<VersionCheck>("get_jl_mixing_version"),
      invoke<ProjectSummary>("read_sample_manifest"),
    ]).then(([system, version, project]) => {
      if (active) setState({ status: "ready", system, version, project });
    }).catch((error: unknown) => {
      if (active) setState({ status: "error", message: error instanceof Error ? error.message : "The architecture checks could not be completed." });
    });
    return () => { active = false; };
  }, []);

  return <main>
    <header className="hero">
      <p className="eyebrow">Architecture validation</p>
      <h1>JL Mixing Studio</h1>
      <p className="lede">A studio-aware desktop workflow for JL Mixing Automation.</p>
    </header>

    {state.status === "loading" && <section className="notice" aria-live="polite">Running local architecture checks…</section>}
    {state.status === "error" && <section className="notice error" role="alert"><strong>Architecture check failed</strong><span>{state.message}</span></section>}

    {state.status === "ready" && <div className="grid">
      <section className="card" aria-labelledby="environment-heading">
        <div className="card-heading"><span className="icon" aria-hidden="true">01</span><div><p className="kicker">Desktop host</p><h2 id="environment-heading">Environment</h2></div></div>
        <dl><div><dt>Operating system</dt><dd>{state.system.operatingSystem}</dd></div><div><dt>Architecture</dt><dd>{state.system.architecture}</dd></div><div><dt>Framework</dt><dd>Tauri 2</dd></div></dl>
      </section>

      <section className="card" aria-labelledby="automation-heading">
        <div className="card-heading"><span className="icon" aria-hidden="true">02</span><div><p className="kicker">Restricted command</p><h2 id="automation-heading">JL Mixing Automation</h2></div></div>
        <p className={`status ${state.version.available ? "success" : "warning"}`}><span aria-hidden="true" />{state.version.available ? "Detected" : "Needs attention"}</p>
        <p>{state.version.message}</p>
        <p className="detail">The frontend can request only the fixed <code>--version</code> operation.</p>
      </section>

      <section className="card project" aria-labelledby="project-heading">
        <div className="card-heading"><span className="icon" aria-hidden="true">03</span><div><p className="kicker">Read-only fixture</p><h2 id="project-heading">{state.project.projectName}</h2></div></div>
        <div className="project-meta">
          <div><span>Artist</span><strong>{state.project.artist}</strong></div><div><span>Project ID</span><strong>{state.project.projectId}</strong></div>
          <div><span>Audio</span><strong>{state.project.sampleRate / 1000} kHz / {state.project.bitDepth}-bit {state.project.fileFormat}</strong></div>
          <div><span>Current</span><strong>{formatRevision(state.project.currentRevision)}</strong></div><div><span>Approved</span><strong>{formatRevision(state.project.approvedRevision)}</strong></div><div><span>Delivered</span><strong>{formatRevision(state.project.deliveredRevision)}</strong></div>
        </div>
        <footer><span>Schema {state.project.schemaVersion}</span><span>Created with {state.project.createdWith}</span></footer>
      </section>
    </div>}
  </main>;
}
