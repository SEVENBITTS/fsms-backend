import { Router } from "express";
import { AirspaceComplianceController } from "./airspace-compliance.controller";

export function createAirspaceComplianceRouter(
  controller: AirspaceComplianceController,
): Router {
  const router = Router();

  router.post(
    "/:missionId/airspace-inputs",
    controller.createAirspaceComplianceInput,
  );
  router.get("/:missionId/airspace", controller.getAirspaceComplianceAssessment);

  return router;
}
