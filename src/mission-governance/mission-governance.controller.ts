import type { NextFunction, Request, Response } from "express";
import { requireCurrentUser } from "../auth/auth.middleware";
import { MissionAccessService } from "../mission-access/mission-access.service";
import { OrganisationMembershipsService } from "../organisation-memberships/organisation-memberships.service";
import { MissionGovernanceService } from "./mission-governance.service";

type MissionIdParams = {
  missionId: string;
};

export class MissionGovernanceController {
  constructor(
    private readonly missionGovernanceService: MissionGovernanceService,
    private readonly missionAccessService: MissionAccessService,
    private readonly organisationMembershipsService: OrganisationMembershipsService,
  ) {}

  getMissionGovernanceAssessment = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = requireCurrentUser(req);
      const organisationId = await this.missionAccessService.getMissionOrganisationId(
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
        await this.missionGovernanceService.assessMissionGovernance(
          req.params.missionId,
        );
      res.status(200).json(assessment);
    } catch (error) {
      next(error);
    }
  };
}
