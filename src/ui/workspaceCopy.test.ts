import { describe, expect, it } from "vitest";

import { workspaceCopy } from "./workspaceCopy";

describe("workspaceCopy", () => {
  it("keeps normal workspace states free of implementation-heavy language", () => {
    const copy = JSON.stringify({
      partial: {
        singleIssue: workspaceCopy.partial.singleIssue,
        multipleIssues: workspaceCopy.partial.multipleIssues(3),
        available: workspaceCopy.partial.available,
        review: workspaceCopy.partial.review,
      },
      unavailable: workspaceCopy.unavailable,
      invalid: workspaceCopy.invalid,
      empty: workspaceCopy.empty,
      issues: workspaceCopy.issues,
    }).toLowerCase();

    for (const term of [
      "authoritative",
      "provider",
      "schema",
      "derived",
      "api",
      "validated workspace",
      "automation-managed",
      "manifest",
      "deletion inventory",
    ]) {
      expect(copy).not.toContain(term);
    }
  });

  it("keeps issue-count wording natural", () => {
    expect(workspaceCopy.partial.singleIssue).toBe(
      "1 thing in your studio needs a quick look",
    );
    expect(workspaceCopy.partial.multipleIssues(4)).toBe(
      "4 things in your studio need a quick look",
    );
  });
});
