import type { NextFunction, Request, Response } from "express";
import { requireCurrentUser } from "../auth/auth.middleware";
import { OrganisationMembershipsService } from "../organisation-memberships/organisation-memberships.service";
import { OrganisationDocumentsService } from "./organisation-documents.service";

type OrganisationIdParams = {
  organisationId: string;
};

type DocumentIdParams = {
  documentId: string;
};

export class OrganisationDocumentsController {
  constructor(
    private readonly organisationDocumentsService: OrganisationDocumentsService,
    private readonly organisationMembershipsService: OrganisationMembershipsService,
  ) {}

  createOrganisationDocument = async (
    req: Request<OrganisationIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
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
      const created =
        await this.organisationDocumentsService.createOrganisationDocument(
          req.params.organisationId,
          req.body,
        );
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  listOrganisationDocuments = async (
    req: Request<OrganisationIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      await this.organisationMembershipsService.requireMembership(
        user.id,
        req.params.organisationId,
        [
          "viewer",
          "operator",
          "operations_manager",
          "compliance_manager",
          "accountable_manager",
          "admin",
        ],
      );
      const listed = await this.organisationDocumentsService.listOrganisationDocuments(
        req.params.organisationId,
      );
      res.status(200).json(listed);
    } catch (error) {
      next(error);
    }
  };

  getDocumentPortal = async (
    req: Request<OrganisationIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      await this.organisationMembershipsService.requireMembership(
        user.id,
        req.params.organisationId,
        [
          "viewer",
          "operator",
          "operations_manager",
          "compliance_manager",
          "accountable_manager",
          "admin",
        ],
      );
      const portal = await this.organisationDocumentsService.getDocumentPortal(
        req.params.organisationId,
      );
      res.status(200).json(portal);
    } catch (error) {
      next(error);
    }
  };

  uploadOrganisationDocument = async (
    req: Request<DocumentIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.organisationDocumentsService.getDocumentOrganisationId(
          req.params.documentId,
        );
      await this.organisationMembershipsService.requireMembership(
        user.id,
        organisationId,
        [
          "operations_manager",
          "compliance_manager",
          "accountable_manager",
          "admin",
        ],
      );
      const updated =
        await this.organisationDocumentsService.uploadOrganisationDocument(
          req.params.documentId,
          req.body,
        );
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };
}
