import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const mockedInvoke = vi.mocked(invoke);

describe("architecture validation screen", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedInvoke
      .mockResolvedValueOnce({ operatingSystem: "macos", architecture: "x86_64" })
      .mockResolvedValueOnce({ available: true, version: "1.2.0", message: "JL Mixing Automation 1.2.0 detected" })
      .mockResolvedValueOnce({ projectId: "architecture-spike", projectName: "Architecture Spike", artist: "Fixture Artist", schemaVersion: "1.1.0", createdWith: "jl-mixing 1.2.0", sampleRate: 48000, bitDepth: 24, fileFormat: "WAV", currentRevision: 1, approvedRevision: null, deliveredRevision: null });
  });

  it("shows typed results returned by the three allowlisted commands", async () => {
    render(<App />);
    expect(screen.getByText(/running local architecture checks/i)).toBeInTheDocument();
    expect(await screen.findByText("Architecture Spike")).toBeInTheDocument();
    expect(screen.getByText("JL Mixing Automation 1.2.0 detected")).toBeInTheDocument();
    expect(screen.getByText("Schema 1.1.0")).toBeInTheDocument();
    expect(mockedInvoke).toHaveBeenCalledTimes(3);
    expect(mockedInvoke).toHaveBeenNthCalledWith(1, "get_system_info");
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "get_jl_mixing_version");
    expect(mockedInvoke).toHaveBeenNthCalledWith(3, "read_sample_manifest");
  });

  it("reports a safe loading failure", async () => {
    mockedInvoke.mockReset();
    mockedInvoke.mockRejectedValueOnce(new Error("Manifest unavailable"));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Manifest unavailable");
  });
});
