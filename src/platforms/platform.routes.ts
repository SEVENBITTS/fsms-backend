import { Router } from "express";
import { PlatformController } from "./platform.controller";

export function createPlatformRouter(controller: PlatformController): Router {
  const router = Router();

  router.post("/", controller.createPlatform);
  router.get("/:id", controller.getPlatform);
  router.post("/:id/maintenance-schedules", controller.createMaintenanceSchedule);
  router.post("/:id/maintenance-records", controller.createMaintenanceRecord);
  router.get("/:id/maintenance-status", controller.getMaintenanceStatus);

  return router;
}
