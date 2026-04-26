import { Router } from "express";
import { SmsFrameworkController } from "./sms-framework.controller";

export function createSmsFrameworkRouter(
  controller: SmsFrameworkController,
): Router {
  const router = Router();

  router.get("/framework", controller.getFramework);
  router.get("/control-mappings", controller.listControlMappings);

  return router;
}
