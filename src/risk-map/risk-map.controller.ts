import type { NextFunction, Request, Response } from "express";
import { requireCurrentUser } from "../auth/auth.middleware";
import { MissionAccessService } from "../mission-access/mission-access.service";
import { OrganisationMembershipsService } from "../organisation-memberships/organisation-memberships.service";
import { RiskMapService } from "./risk-map.service";

type MissionIdParams = {
  missionId: string;
};

export class RiskMapController {
  constructor(
    private readonly riskMapService: RiskMapService,
    private readonly missionAccessService: MissionAccessService,
    private readonly organisationMembershipsService: OrganisationMembershipsService,
  ) {}

  getMissionRiskMap = async (
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
      const riskMap = await this.riskMapService.getMissionRiskMap(
        req.params.missionId,
      );
      res.status(200).json(riskMap);
    } catch (error) {
      next(error);
    }
  };
}
