import { Router } from "express";
import { OrganisationDocumentsController } from "./organisation-documents.controller";

export function createOrganisationDocumentsOrganisationRouter(
  controller: OrganisationDocumentsController,
): Router {
  const router = Router();

  router.post("/:organisationId/documents", controller.createOrganisationDocument);
  router.get("/:organisationId/documents", controller.listOrganisationDocuments);
  router.get("/:organisationId/document-portal", controller.getDocumentPortal);

  return router;
}

export function createOrganisationDocumentsUploadRouter(
  controller: OrganisationDocumentsController,
): Router {
  const router = Router();

  router.post("/:documentId/upload", controller.uploadOrganisationDocument);

  return router;
}
