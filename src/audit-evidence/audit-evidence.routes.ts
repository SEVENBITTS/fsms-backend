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

  return router;
}
