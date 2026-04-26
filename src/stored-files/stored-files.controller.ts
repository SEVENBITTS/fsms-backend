import type { NextFunction, Request, Response } from "express";
import { requireCurrentUser } from "../auth/auth.middleware";
import { OrganisationMembershipsService } from "../organisation-memberships/organisation-memberships.service";
import { StoredFilesService } from "./stored-files.service";

type OrganisationIdParams = {
  organisationId: string;
};

type StoredFileIdParams = {
  fileId: string;
};

type StoredFileContentQuery = {
  disposition?: string;
};

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export class StoredFilesController {
  constructor(
    private readonly storedFilesService: StoredFilesService,
    private readonly organisationMembershipsService: OrganisationMembershipsService,
  ) {}

  uploadStoredFile = async (
    req: Request<OrganisationIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const membership =
        await this.organisationMembershipsService.requireMembership(
          user.id,
          req.params.organisationId,
          [
            "operations_manager",
            "compliance_manager",
            "accountable_manager",
            "admin",
          ],
        );

      const created = await this.storedFilesService.createStoredFile({
        organisationId: req.params.organisationId,
        originalFileName: firstHeaderValue(req.headers["x-file-name"]),
        contentType: req.headers["content-type"] ?? null,
        sourceDocumentType: firstHeaderValue(
          req.headers["x-source-document-type"],
        ),
        uploadedBy: firstHeaderValue(req.headers["x-uploaded-by"]) ?? user.id,
        fileBuffer: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
      });

      res.setHeader("X-Organisation-Role", membership.role);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  getStoredFileMetadata = async (
    req: Request<StoredFileIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const storedFile = await this.storedFilesService.getStoredFileMetadata(
        req.params.fileId,
      );
      const membership =
        await this.organisationMembershipsService.requireMembership(
          user.id,
          storedFile.file.organisationId,
          [
            "viewer",
            "operator",
            "operations_manager",
            "compliance_manager",
            "accountable_manager",
            "admin",
          ],
        );
      res.setHeader("X-Organisation-Role", membership.role);
      res.status(200).json(storedFile);
    } catch (error) {
      next(error);
    }
  };

  downloadStoredFile = async (
    req: Request<StoredFileIdParams, unknown, unknown, StoredFileContentQuery>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const { file, fileBuffer } =
        await this.storedFilesService.getStoredFileContent(req.params.fileId);
      const membership =
        await this.organisationMembershipsService.requireMembership(
          user.id,
          file.organisationId,
          [
            "operations_manager",
            "compliance_manager",
            "accountable_manager",
            "admin",
          ],
        );
      const disposition =
        req.query.disposition === "inline" ? "inline" : "attachment";

      res.setHeader(
        "Content-Type",
        file.contentType ?? "application/octet-stream",
      );
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${file.originalFileName}"`,
      );
      res.setHeader("X-Organisation-Role", membership.role);
      res.status(200).send(fileBuffer);
    } catch (error) {
      next(error);
    }
  };
}
