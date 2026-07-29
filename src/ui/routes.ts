export type PrimaryRoute =
  | "dashboard"
  | "studio"
  | "clients"
  | "projects"
  | "tasks"
  | "reports"
  | "activity"
  | "settings";

export interface RouteDefinition {
  id: PrimaryRoute;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
}

/**
 * Central route metadata for the persistent application shell.
 *
 * Normal route copy follows the approved #101 voice: creative collaborator +
 * studio casual. Keep implementation terminology out of these strings; reserve
 * technical language for Metadata and diagnostic views where it helps the user.
 */
export const routes: RouteDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    eyebrow: "Studio overview",
    title: "What’s happening today?",
    description: "Here’s what’s happening in the studio and what needs your attention next.",
  },
  {
    id: "studio",
    label: "Studio",
    eyebrow: "Your studio",
    title: "Studio",
    description: "Your studio setup, mix defaults, workspace, and troubleshooting details.",
  },
  {
    id: "clients",
    label: "Clients",
    eyebrow: "Who you’re working with",
    title: "Clients",
    description: "Find a client, check their defaults, or jump into a project.",
  },
  {
    id: "projects",
    label: "Projects",
    eyebrow: "What you’re working on",
    title: "Projects",
    description: "See every project and where each mix stands.",
  },
  {
    id: "tasks",
    label: "Tasks",
    eyebrow: "Up next",
    title: "Tasks",
    description: "A quick look at what needs your attention.",
  },
  {
    id: "reports",
    label: "Reports",
    eyebrow: "Project reports",
    title: "Reports",
    description: "Find intake, delivery, and other project reports in one place.",
  },
  {
    id: "activity",
    label: "Activity Log",
    eyebrow: "Recent activity",
    title: "Activity Log",
    description: "See the latest project updates across the studio.",
  },
  {
    id: "settings",
    label: "Settings",
    eyebrow: "Make it yours",
    title: "Settings",
    description: "Adjust how JL Mixing Studio looks and behaves.",
  },
];
