import type { NextFunction, Request, Response } from "express";
import { requireCurrentUser } from "../auth/auth.middleware";
import { OrganisationMembershipsService } from "../organisation-memberships/organisation-memberships.service";
import { OperationalAuthorityService } from "./operational-authority.service";

type OrganisationIdParams = {
  organisationId: string;
};

type ProfileIdParams = {
  profileId: string;
};

type PilotAuthorisationIdParams = {
  authorisationId: string;
};

type DocumentIdParams = {
  documentId: string;
};

type MissionIdParams = {
  missionId: string;
};

export class OperationalAuthorityController {
  constructor(
    private readonly operationalAuthorityService: OperationalAuthorityService,
    private readonly organisationMembershipsService: OrganisationMembershipsService,
  ) {}

  createOperationalAuthorityDocument = async (
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
        await this.operationalAuthorityService.createOperationalAuthorityDocument(
          req.params.organisationId,
          req.body,
        );
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  activateOperationalAuthorityProfile = async (
    req: Request<ProfileIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.operationalAuthorityService.getProfileOrganisationId(
          req.params.profileId,
        );
      await this.organisationMembershipsService.requireMembership(
        user.id,
        organisationId,
        ["compliance_manager", "accountable_manager", "admin"],
      );
      const activated =
        await this.operationalAuthorityService.activateOperationalAuthorityProfile(
          req.params.profileId,
          req.body,
        );
      res.status(200).json(activated);
    } catch (error) {
      next(error);
    }
  };

  uploadOperationalAuthorityDocument = async (
    req: Request<DocumentIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.operationalAuthorityService.getDocumentOrganisationId(
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
        await this.operationalAuthorityService.uploadOperationalAuthorityDocument(
          req.params.documentId,
          req.body,
        );
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  getMissionOperationalAuthorityAssessment = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.operationalAuthorityService.getMissionOrganisationId(
          req.params.missionId,
        );
      await this.organisationMembershipsService.requireMembership(
        user.id,
        organisationId,
        [
          "viewer",
          "operator",
          "operations_manager",
          "compliance_manager",
          "accountable_manager",
          "admin",
        ],
      );
      const assessment =
        await this.operationalAuthorityService.assessMissionOperationalAuthority(
          req.params.missionId,
        );
      res.status(200).json(assessment);
    } catch (error) {
      next(error);
    }
  };

  listMissionSopChangeRecommendations = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.operationalAuthorityService.getMissionOrganisationId(
          req.params.missionId,
        );
      await this.organisationMembershipsService.requireMembership(
        user.id,
        organisationId,
        [
          "viewer",
          "operator",
          "operations_manager",
          "compliance_manager",
          "accountable_manager",
          "admin",
        ],
      );
      const listed =
        await this.operationalAuthorityService.listSopChangeRecommendations(
          req.params.missionId,
        );
      res.status(200).json(listed);
    } catch (error) {
      next(error);
    }
  };

  createMissionSopChangeRecommendation = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.operationalAuthorityService.getMissionOrganisationId(
          req.params.missionId,
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
      const created =
        await this.operationalAuthorityService.createSopChangeRecommendation(
          req.params.missionId,
          req.body,
        );
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  listPilotAuthorisations = async (
    req: Request<ProfileIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.operationalAuthorityService.getProfileOrganisationId(
          req.params.profileId,
        );
      await this.organisationMembershipsService.requireMembership(
        user.id,
        organisationId,
        [
          "viewer",
          "operator",
          "operations_manager",
          "compliance_manager",
          "accountable_manager",
          "admin",
        ],
      );
      const listed = await this.operationalAuthorityService.listPilotAuthorisations(
        req.params.profileId,
      );
      res.status(200).json(listed);
    } catch (error) {
      next(error);
    }
  };

  listSopDocuments = async (
    req: Request<ProfileIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.operationalAuthorityService.getProfileOrganisationId(
          req.params.profileId,
        );
      await this.organisationMembershipsService.requireMembership(
        user.id,
        organisationId,
        [
          "viewer",
          "operator",
          "operations_manager",
          "compliance_manager",
          "accountable_manager",
          "admin",
        ],
      );
      const listed = await this.operationalAuthorityService.listSopDocuments(
        req.params.profileId,
      );
      res.status(200).json(listed);
    } catch (error) {
      next(error);
    }
  };

  createSopDocument = async (
    req: Request<ProfileIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.operationalAuthorityService.getProfileOrganisationId(
          req.params.profileId,
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
      const created = await this.operationalAuthorityService.createSopDocument(
        req.params.profileId,
        req.body,
      );
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  createPilotAuthorisation = async (
    req: Request<ProfileIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.operationalAuthorityService.getProfileOrganisationId(
          req.params.profileId,
        );
      await this.organisationMembershipsService.requireMembership(
        user.id,
        organisationId,
        ["compliance_manager", "accountable_manager", "admin"],
      );
      const created =
        await this.operationalAuthorityService.createPilotAuthorisation(
          req.params.profileId,
          req.body,
        );
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  updatePilotAuthorisation = async (
    req: Request<PilotAuthorisationIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.operationalAuthorityService.getPilotAuthorisationOrganisationId(
          req.params.authorisationId,
        );
      await this.organisationMembershipsService.requireMembership(
        user.id,
        organisationId,
        ["compliance_manager", "accountable_manager", "admin"],
      );
      const updated =
        await this.operationalAuthorityService.updatePilotAuthorisation(
          req.params.authorisationId,
          req.body,
        );
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  listPilotAuthorisationReviews = async (
    req: Request<PilotAuthorisationIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.operationalAuthorityService.getPilotAuthorisationOrganisationId(
          req.params.authorisationId,
        );
      await this.organisationMembershipsService.requireMembership(
        user.id,
        organisationId,
        [
          "viewer",
          "operator",
          "operations_manager",
          "compliance_manager",
          "accountable_manager",
          "admin",
        ],
      );
      const listed =
        await this.operationalAuthorityService.listPilotAuthorisationReviews(
          req.params.authorisationId,
        );
      res.status(200).json(listed);
    } catch (error) {
      next(error);
    }
  };

  createPilotAuthorisationReview = async (
    req: Request<PilotAuthorisationIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId =
        await this.operationalAuthorityService.getPilotAuthorisationOrganisationId(
          req.params.authorisationId,
        );
      await this.organisationMembershipsService.requireMembership(
        user.id,
        organisationId,
        ["accountable_manager", "admin"],
      );
      const created =
        await this.operationalAuthorityService.createPilotAuthorisationReview(
          req.params.authorisationId,
          req.body,
        );
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };
}
