import { Router } from "express";
import { SafetyEventController } from "./safety-event.controller";

export function createSafetyEventRouter(
  controller: SafetyEventController,
): Router {
  const router = Router();

  router.post("/", controller.createSafetyEvent);
  router.get("/", controller.listSafetyEvents);
  router.post("/:eventId/meeting-trigger", controller.assessMeetingTrigger);
  router.get("/:eventId/meeting-triggers", controller.listMeetingTriggers);

  return router;
}
