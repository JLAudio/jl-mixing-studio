import type { DeliveryCreationPreview, DeliveryCreationRequest } from "../types";

export type DeliveryWorkflowState =
  | { status: "closed" }
  | { status: "options"; request: DeliveryCreationRequest }
  | { status: "preflighting"; request: DeliveryCreationRequest }
  | { status: "confirming"; request: DeliveryCreationRequest; preview: DeliveryCreationPreview }
  | { status: "creating"; request: DeliveryCreationRequest; preview: DeliveryCreationPreview }
  | { status: "uncertain"; message: string };

/**
 * A delivery commit is allowed only for the exact plan the user reviewed.
 * Keep this comparison in lockstep with preview fields that can change paths,
 * destructive scope, or packaged contents.
 */
export const sameDeliveryPlan = (
  left: DeliveryCreationPreview,
  right: DeliveryCreationPreview,
) =>
  left.clientId === right.clientId &&
  left.projectId === right.projectId &&
  left.projectName === right.projectName &&
  left.currentRevision === right.currentRevision &&
  left.approvedRevision === right.approvedRevision &&
  left.deliveryMethod === right.deliveryMethod &&
  left.replacementMode === right.replacementMode &&
  left.createZip === right.createZip &&
  left.deletions.length === right.deletions.length &&
  left.deletions.every((path, index) => path === right.deletions[index]) &&
  left.selected.length === right.selected.length &&
  left.selected.every((file, index) => {
    const candidate = right.selected[index];
    return candidate &&
      file.sourceName === candidate.sourceName &&
      file.deliverableType === candidate.deliverableType &&
      file.path === candidate.path;
  });
