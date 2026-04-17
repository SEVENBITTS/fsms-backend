import { Router } from "express";
import { AlertController } from "./alert.controller";

export function createAlertRouter(controller: AlertController): Router {
  const router = Router();

  router.get("/:id/alerts", controller.getAlertsForMission);

  return router;
}