import type { NextFunction, Request, Response } from "express";
import { requireCurrentUser } from "../auth/auth.middleware";
import { OrganisationMembershipsService } from "../organisation-memberships/organisation-memberships.service";
import { InsuranceService } from "./insurance.service";

type OrganisationIdParams = {
  organisationId: string;
};

type ProfileIdParams = {
  profileId: string;
};

type DocumentIdParams = {
  documentId: string;
};

type MissionIdParams = {
  missionId: string;
};

export class InsuranceController {
  constructor(
    private readonly insuranceService: InsuranceService,
    private readonly organisationMembershipsService: OrganisationMembershipsService,
  ) {}

  createInsuranceDocument = async (
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
      const created = await this.insuranceService.createInsuranceDocument(
        req.params.organisationId,
        req.body,
      );
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  uploadInsurancePolicy = async (
    req: Request<DocumentIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId = await this.insuranceService.getDocumentOrganisationId(
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
      const updated = await this.insuranceService.uploadInsurancePolicy(
        req.params.documentId,
        req.body,
      );
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  activateInsuranceProfile = async (
    req: Request<ProfileIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId = await this.insuranceService.getProfileOrganisationId(
        req.params.profileId,
      );
      await this.organisationMembershipsService.requireMembership(
        user.id,
        organisationId,
        ["compliance_manager", "accountable_manager", "admin"],
      );
      const activated = await this.insuranceService.activateInsuranceProfile(
        req.params.profileId,
        req.body,
      );
      res.status(200).json(activated);
    } catch (error) {
      next(error);
    }
  };

  getMissionInsuranceAssessment = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId = await this.insuranceService.getMissionOrganisationId(
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
      const assessment = await this.insuranceService.assessMissionInsurance(
        req.params.missionId,
      );
      res.status(200).json(assessment);
    } catch (error) {
      next(error);
    }
  };
}
