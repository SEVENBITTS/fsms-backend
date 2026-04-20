import { Router } from "express";
import { AirSafetyMeetingController } from "./air-safety-meeting.controller";

export function createAirSafetyMeetingRouter(
  controller: AirSafetyMeetingController,
): Router {
  const router = Router();

  router.post("/", controller.createAirSafetyMeeting);
  router.get("/", controller.listAirSafetyMeetings);
  router.get("/quarterly-compliance", controller.getQuarterlyCompliance);
  router.get("/:meetingId/export", controller.exportAirSafetyMeetingPack);

  return router;
}
