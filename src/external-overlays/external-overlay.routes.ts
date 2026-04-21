import { Router } from "express";
import { ExternalOverlayController } from "./external-overlay.controller";

export function createExternalOverlayRouter(
  controller: ExternalOverlayController,
): Router {
  const router = Router();

  router.post("/:missionId/external-overlays", controller.createExternalOverlay);
  router.get("/:missionId/external-overlays", controller.listExternalOverlays);

  return router;
}
