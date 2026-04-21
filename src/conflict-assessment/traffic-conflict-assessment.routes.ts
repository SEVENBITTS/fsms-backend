import { Router } from "express";
import { TrafficConflictAssessmentController } from "./traffic-conflict-assessment.controller";

export function createTrafficConflictAssessmentRouter(
  controller: TrafficConflictAssessmentController,
): Router {
  const router = Router();

  router.get(
    "/:missionId/conflict-assessment",
    controller.getMissionConflictAssessment,
  );

  return router;
}
