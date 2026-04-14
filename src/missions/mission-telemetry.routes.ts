import { Router } from "express";
import { MissionTelemetryController } from "./mission-telemetry.controller";

export function createMissionTelemetryRouter(
  controller: MissionTelemetryController,
): Router {
  const router = Router();

  router.post("/:id/telemetry", controller.recordTelemetry);
  router.get("/:id/telemetry/latest", controller.getLatestTelemetry);
  router.get("/:id/telemetry", controller.getTelemetryHistory);

  return router;
}