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
  router.post(
    "/:eventId/meeting-triggers/:triggerId/agenda-links",
    controller.createAgendaLink,
  );
  router.get("/:eventId/agenda-links", controller.listAgendaLinks);

  return router;
}
