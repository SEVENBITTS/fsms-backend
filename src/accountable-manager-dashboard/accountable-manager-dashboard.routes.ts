import { Router } from "express";
import { AccountableManagerDashboardController } from "./accountable-manager-dashboard.controller";

export function createAccountableManagerDashboardRouter(
  controller: AccountableManagerDashboardController,
): Router {
  const router = Router();

  router.get(
    "/:organisationId/accountable-manager-dashboard",
    controller.getDashboard,
  );

  return router;
}
