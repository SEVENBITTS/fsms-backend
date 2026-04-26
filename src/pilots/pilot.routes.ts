import { Router } from "express";
import { PilotController } from "./pilot.controller";

export function createPilotRouter(controller: PilotController): Router {
  const router = Router();

  router.post("/", controller.createPilot);
  router.get("/:id", controller.getPilot);
  router.post("/:id/readiness-evidence", controller.createReadinessEvidence);
  router.get("/:id/readiness", controller.getReadiness);

  return router;
}
