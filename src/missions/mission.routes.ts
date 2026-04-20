import { Router } from "express";
import { MissionController } from "./mission.controller";

export function createMissionRouter(
  missionController: MissionController,
): Router {
  const router = Router();

  router.get("/", missionController.listMissions);
  router.post("/:missionId/submit", missionController.submitMission);
  router.post("/:missionId/approve", missionController.approveMission);
  router.post("/:missionId/launch", missionController.launchMission);
  router.post("/:missionId/complete", missionController.completeMission);
  router.post("/:missionId/abort", missionController.abortMission);

  router.get(
    "/:missionId/planning-workspace",
    missionController.getPlanningWorkspace,
  );
  router.get(
    "/:missionId/dispatch-workspace",
    missionController.getDispatchWorkspace,
  );
  router.get(
    "/:missionId/operations-timeline",
    missionController.getOperationsTimeline,
  );
  router.get("/:missionId/events", missionController.getMissionEvents);
  router.get("/:missionId/readiness", missionController.checkReadiness);
  router.get(
    "/:missionId/transitions/:action/check",
    missionController.checkTransition,
  );

  return router;
}
