import { copy as productCopy } from "../resources/copy";

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
export const routes: RouteDefinition[] = ([
  "dashboard",
  "studio",
  "clients",
  "projects",
  "tasks",
  "reports",
  "activity",
  "settings",
] as const).map((id) => ({ id, ...productCopy.routes[id] }));
