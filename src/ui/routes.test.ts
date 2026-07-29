import { describe, expect, it } from "vitest";

import { routes } from "./routes";

const implementationTerms = [
  "authoritative",
  "provider",
  "schema",
  "derived",
  "api",
  "validated workspace",
  "automation-managed",
  "manifest",
  "deletion inventory",
];

describe("route copy", () => {
  it("keeps normal navigation copy free of implementation terminology", () => {
    const visibleCopy = routes
      .flatMap(({ label, eyebrow, title, description }) => [label, eyebrow, title, description])
      .join(" ")
      .toLowerCase();

    for (const term of implementationTerms) {
      expect(visibleCopy).not.toContain(term);
    }
  });

  it("provides complete display copy for every route", () => {
    for (const route of routes) {
      expect(route.label.trim()).not.toBe("");
      expect(route.eyebrow.trim()).not.toBe("");
      expect(route.title.trim()).not.toBe("");
      expect(route.description.trim()).not.toBe("");
    }
  });
});
