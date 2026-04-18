import { Router } from "express";
import { AuditEvidenceController } from "./audit-evidence.controller";

export function createAuditEvidenceRouter(
  controller: AuditEvidenceController,
): Router {
  const router = Router();

  router.post(
    "/:missionId/readiness/audit-snapshots",
    controller.createMissionReadinessSnapshot,
  );
  router.get(
    "/:missionId/readiness/audit-snapshots",
    controller.listMissionReadinessSnapshots,
  );
  router.post(
    "/:missionId/decision-evidence-links",
    controller.createMissionDecisionEvidenceLink,
  );
  router.get(
    "/:missionId/decision-evidence-links",
    controller.listMissionDecisionEvidenceLinks,
  );
  router.post(
    "/:missionId/post-operation/evidence-snapshots",
    controller.createPostOperationEvidenceSnapshot,
  );
  router.get(
    "/:missionId/post-operation/evidence-snapshots",
    controller.listPostOperationEvidenceSnapshots,
  );

  return router;
}
