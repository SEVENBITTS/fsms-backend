import { Router } from "express";
import { AlertController } from "./alert.controller";

export function createAlertRouter(controller: AlertController): Router {
  const router = Router();

  router.get("/:id/alerts", controller.getAlertsForMission);
  router.post(
    "/:id/regulatory-amendments",
    controller.createRegulatoryAmendmentAlert,
  );
  router.get(
    "/:id/regulatory-review-impact",
    controller.getRegulatoryReviewImpact,
  );
  router.post("/:id/alerts/:alertId/acknowledge", controller.acknowledgeAlert);
  router.post("/:id/alerts/:alertId/resolve", controller.resolveAlert);

  return router;
}
