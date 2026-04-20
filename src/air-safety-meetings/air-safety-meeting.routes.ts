import { Router } from "express";
import { AirSafetyMeetingController } from "./air-safety-meeting.controller";

export function createAirSafetyMeetingRouter(
  controller: AirSafetyMeetingController,
): Router {
  const router = Router();

  router.post("/", controller.createAirSafetyMeeting);
  router.get("/", controller.listAirSafetyMeetings);
  router.post("/approval-rollup/signoffs", controller.createGovernanceApprovalRollupSignoff);
  router.get("/approval-rollup/signoffs", controller.listGovernanceApprovalRollupSignoffs);
  router.get("/approval-rollup/pdf", controller.generateAirSafetyMeetingApprovalRollupPdf);
  router.get("/approval-rollup/render", controller.renderAirSafetyMeetingApprovalRollup);
  router.get("/approval-rollup", controller.exportAirSafetyMeetingApprovalRollup);
  router.get("/quarterly-compliance", controller.getQuarterlyCompliance);
  router.post("/:meetingId/signoffs", controller.createAirSafetyMeetingSignoff);
  router.get("/:meetingId/signoffs", controller.listAirSafetyMeetingSignoffs);
  router.get("/:meetingId/export/pdf", controller.generateAirSafetyMeetingPackPdf);
  router.get("/:meetingId/export/render", controller.renderAirSafetyMeetingPack);
  router.get("/:meetingId/export", controller.exportAirSafetyMeetingPack);

  return router;
}
