import { Router } from "express";
import { AlertController } from "./alert.controller";

export function createAlertRouter(controller: AlertController): Router {
  const router = Router();

  router.get("/:id/alerts", controller.getAlertsForMission);
  router.post(
    "/:id/regulatory-amendments",
    controller.createRegulatoryAmendmentAlert,
  );

  return router;
}
