import { Router } from "express";
import { OrganisationMembershipsController } from "./organisation-memberships.controller";

export function createOrganisationMembershipsRouter(
  controller: OrganisationMembershipsController,
): Router {
  const router = Router();

  router.post("/:organisationId/memberships", controller.createMembership);

  return router;
}
