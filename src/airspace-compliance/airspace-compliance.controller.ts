import type { NextFunction, Request, Response } from "express";
import { AirspaceComplianceService } from "./airspace-compliance.service";

type MissionIdParams = {
  missionId: string;
};

export class AirspaceComplianceController {
  constructor(
    private readonly airspaceComplianceService: AirspaceComplianceService,
  ) {}

  createAirspaceComplianceInput = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const input =
        await this.airspaceComplianceService.createAirspaceComplianceInput(
          req.params.missionId,
          req.body,
        );
      res.status(201).json({ input });
    } catch (error) {
      next(error);
    }
  };

  getAirspaceComplianceAssessment = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const assessment =
        await this.airspaceComplianceService.assessAirspaceCompliance(
          req.params.missionId,
        );
      res.status(200).json(assessment);
    } catch (error) {
      next(error);
    }
  };
}
