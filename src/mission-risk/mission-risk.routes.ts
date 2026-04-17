import { Router } from "express";
import { MissionRiskController } from "./mission-risk.controller";

export function createMissionRiskRouter(
  controller: MissionRiskController,
): Router {
  const router = Router();

  router.post("/:missionId/risk-inputs", controller.createMissionRiskInput);
  router.get("/:missionId/risk", controller.getMissionRiskAssessment);

  return router;
}
