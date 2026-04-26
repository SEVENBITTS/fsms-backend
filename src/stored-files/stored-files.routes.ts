import express, { Router } from "express";
import { StoredFilesController } from "./stored-files.controller";

const rawUploadParser = express.raw({
  type: () => true,
  limit: "25mb",
});

export function createStoredFilesOrganisationRouter(
  controller: StoredFilesController,
): Router {
  const router = Router();

  router.post("/:organisationId/files", rawUploadParser, controller.uploadStoredFile);

  return router;
}

export function createStoredFilesRouter(
  controller: StoredFilesController,
): Router {
  const router = Router();

  router.get("/:fileId", controller.getStoredFileMetadata);
  router.get("/:fileId/content", controller.downloadStoredFile);

  return router;
}
