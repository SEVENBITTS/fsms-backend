import { Router } from "express";
import { MissionReplayController } from "./mission-replay.controller";

export function createMissionReplayRouter(
  controller: MissionReplayController,
): Router {
  const router = Router();

  router.get("/:id/replay", controller.getMissionReplay);

  return router;
}
