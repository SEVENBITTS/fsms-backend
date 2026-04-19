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
  router.post(
    "/:eventId/agenda-links/:agendaLinkId/action-proposals",
    controller.createSafetyActionProposal,
  );
  router.get(
    "/:eventId/agenda-links/:agendaLinkId/action-proposals",
    controller.listSafetyActionProposals,
  );
  router.post(
    "/:eventId/agenda-links/:agendaLinkId/action-proposals/:proposalId/decisions",
    controller.createSafetyActionDecision,
  );
  router.get(
    "/:eventId/agenda-links/:agendaLinkId/action-proposals/:proposalId/decisions",
    controller.listSafetyActionDecisions,
  );

  return router;
}
