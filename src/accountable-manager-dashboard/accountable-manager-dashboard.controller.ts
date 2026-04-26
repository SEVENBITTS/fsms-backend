import type { NextFunction, Request, Response } from "express";
import { requireCurrentUser } from "../auth/auth.middleware";
import { OrganisationMembershipsService } from "../organisation-memberships/organisation-memberships.service";
import { AccountableManagerDashboardService } from "./accountable-manager-dashboard.service";

type OrganisationIdParams = {
  organisationId: string;
};

export class AccountableManagerDashboardController {
  constructor(
    private readonly dashboardService: AccountableManagerDashboardService,
    private readonly organisationMembershipsService: OrganisationMembershipsService,
  ) {}

  getDashboard = async (
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
      const dashboard = await this.dashboardService.getDashboard(
        req.params.organisationId,
        membership.role,
      );
      res.status(200).json(dashboard);
    } catch (error) {
      next(error);
    }
  };
}
