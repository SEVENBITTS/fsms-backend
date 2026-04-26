import { Router } from "express";
import { RiskMapController } from "./risk-map.controller";

export function createRiskMapRouter(controller: RiskMapController): Router {
  const router = Router();

  router.get("/:missionId/risk-map", controller.getMissionRiskMap);

  return router;
}
