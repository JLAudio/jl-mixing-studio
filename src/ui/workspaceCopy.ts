export const workspaceCopy = {
  partial: {
    singleIssue: "1 thing in your studio needs a quick look",
    multipleIssues: (count: number) => `${count} things in your studio need a quick look`,
    available: "Your other clients and projects are still ready to use.",
    review: "Take a look",
  },
  unavailable: {
    kicker: "Let’s get set up",
    title: "Your studio workspace isn’t ready yet",
    description: "Set up JL Mixing Automation to create your studio workspace, then come back here to get started.",
  },
  invalid: {
    kicker: "Something needs attention",
    title: "Something doesn’t look right with this studio",
    description: "Check the details below, fix what needs attention, then try again.",
  },
  empty: {
    kicker: "You’re ready to go",
    title: "No clients or projects yet",
    description: "Create your first client when you’re ready to get started.",
  },
  issues: {
    kicker: "A few things to check",
    title: "Studio setup",
  },
} as const;
