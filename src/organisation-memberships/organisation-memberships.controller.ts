import type { NextFunction, Request, Response } from "express";
import { OrganisationMembershipsService } from "./organisation-memberships.service";

type OrganisationIdParams = {
  organisationId: string;
};

export class OrganisationMembershipsController {
  constructor(
    private readonly organisationMembershipsService: OrganisationMembershipsService,
  ) {}

  createMembership = async (
    req: Request<OrganisationIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const created = await this.organisationMembershipsService.createMembership(
        req.params.organisationId,
        req.body,
      );
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };
}
