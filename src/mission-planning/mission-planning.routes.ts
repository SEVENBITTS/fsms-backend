import { Router } from "express";
import { MissionPlanningController } from "./mission-planning.controller";

export function createMissionPlanningRouter(
  controller: MissionPlanningController,
): Router {
  const router = Router();

  router.post("/drafts", controller.createDraft);
  router.patch("/drafts/:missionId", controller.updateDraft);
  router.get("/drafts/:missionId/review", controller.reviewDraft);
  router.get("/drafts/:missionId", controller.getDraft);

  return router;
}
