import { Router } from "express";
import { OperationalAuthorityController } from "./operational-authority.controller";

export function createOperationalAuthorityOrganisationRouter(
  controller: OperationalAuthorityController,
): Router {
  const router = Router();

  router.post(
    "/:organisationId/operational-authority-documents",
    controller.createOperationalAuthorityDocument,
  );

  return router;
}

export function createOperationalAuthorityMissionRouter(
  controller: OperationalAuthorityController,
): Router {
  const router = Router();

  router.get("/:missionId/oa-assessment", controller.getMissionOperationalAuthorityAssessment);
  router.get(
    "/:missionId/sop-change-recommendations",
    controller.listMissionSopChangeRecommendations,
  );
  router.post(
    "/:missionId/sop-change-recommendations",
    controller.createMissionSopChangeRecommendation,
  );

  return router;
}

export function createOperationalAuthorityDocumentRouter(
  controller: OperationalAuthorityController,
): Router {
  const router = Router();

  router.post(
    "/:documentId/upload",
    controller.uploadOperationalAuthorityDocument,
  );

  return router;
}

export function createOperationalAuthorityProfileRouter(
  controller: OperationalAuthorityController,
): Router {
  const router = Router();

  router.get(
    "/:profileId/pilot-authorisations",
    controller.listPilotAuthorisations,
  );
  router.post(
    "/:profileId/pilot-authorisations",
    controller.createPilotAuthorisation,
  );
  router.get(
    "/:profileId/sop-documents",
    controller.listSopDocuments,
  );
  router.post(
    "/:profileId/sop-documents",
    controller.createSopDocument,
  );
  router.post(
    "/:profileId/activate",
    controller.activateOperationalAuthorityProfile,
  );

  return router;
}

export function createOperationalAuthorityPilotAuthorisationRouter(
  controller: OperationalAuthorityController,
): Router {
  const router = Router();

  router.patch(
    "/:authorisationId",
    controller.updatePilotAuthorisation,
  );
  router.get(
    "/:authorisationId/reviews",
    controller.listPilotAuthorisationReviews,
  );
  router.post(
    "/:authorisationId/reviews",
    controller.createPilotAuthorisationReview,
  );

  return router;
}
