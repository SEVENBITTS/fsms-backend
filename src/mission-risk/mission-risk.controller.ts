import type { NextFunction, Request, Response } from "express";
import { MissionRiskService } from "./mission-risk.service";

type MissionIdParams = {
  missionId: string;
};

export class MissionRiskController {
  constructor(private readonly missionRiskService: MissionRiskService) {}

  createMissionRiskInput = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const input = await this.missionRiskService.createMissionRiskInput(
        req.params.missionId,
        req.body,
      );
      res.status(201).json({ input });
    } catch (error) {
      next(error);
    }
  };

  getMissionRiskAssessment = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const assessment = await this.missionRiskService.assessMissionRisk(
        req.params.missionId,
      );
      res.status(200).json(assessment);
    } catch (error) {
      next(error);
    }
  };
}
