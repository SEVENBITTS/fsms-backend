import { Router } from "express";
import { MissionController } from "./mission.controller";

export function createMissionRouter(
  missionController: MissionController,
): Router {
  const router = Router();

  router.post("/:missionId/submit", missionController.submitMission);
  router.post("/:missionId/approve", missionController.approveMission);
  router.post("/:missionId/launch", missionController.launchMission);
  router.post("/:missionId/complete", missionController.completeMission);
  router.post("/:missionId/abort", missionController.abortMission);

router.get("/:missionId/events", missionController.getMissionEvents);

  return router;
}