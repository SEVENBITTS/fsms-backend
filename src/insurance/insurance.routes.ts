import { Router } from "express";
import { InsuranceController } from "./insurance.controller";

export function createInsuranceOrganisationRouter(
  controller: InsuranceController,
): Router {
  const router = Router();

  router.post("/:organisationId/insurance-documents", controller.createInsuranceDocument);

  return router;
}

export function createInsuranceMissionRouter(
  controller: InsuranceController,
): Router {
  const router = Router();

  router.get("/:missionId/insurance-assessment", controller.getMissionInsuranceAssessment);

  return router;
}

export function createInsuranceDocumentRouter(
  controller: InsuranceController,
): Router {
  const router = Router();

  router.post("/:documentId/upload", controller.uploadInsurancePolicy);

  return router;
}

export function createInsuranceProfileRouter(
  controller: InsuranceController,
): Router {
  const router = Router();

  router.post("/:profileId/activate", controller.activateInsuranceProfile);

  return router;
}
