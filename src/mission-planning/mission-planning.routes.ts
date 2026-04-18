import { Router } from "express";
import { MissionPlanningController } from "./mission-planning.controller";

export function createMissionPlanningRouter(
  controller: MissionPlanningController,
): Router {
  const router = Router();

  router.post("/drafts", controller.createDraft);
  router.get("/drafts/:missionId", controller.getDraft);

  return router;
}
