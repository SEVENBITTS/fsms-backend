import { Router } from "express";
import { MissionGovernanceController } from "./mission-governance.controller";

export function createMissionGovernanceRouter(
  controller: MissionGovernanceController,
): Router {
  const router = Router();

  router.get(
    "/:missionId/governance-assessment",
    controller.getMissionGovernanceAssessment,
  );

  return router;
}
