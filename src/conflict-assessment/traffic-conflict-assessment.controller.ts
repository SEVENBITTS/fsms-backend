import type { NextFunction, Request, Response } from "express";
import { TrafficConflictAssessmentService } from "./traffic-conflict-assessment.service";

type MissionIdParams = {
  missionId: string;
};

export class TrafficConflictAssessmentController {
  constructor(
    private readonly trafficConflictAssessmentService: TrafficConflictAssessmentService,
  ) {}

  getMissionConflictAssessment = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const assessment =
        await this.trafficConflictAssessmentService.assessMission(
          req.params.missionId,
        );

      res.status(200).json({ assessment });
    } catch (error) {
      next(error);
    }
  };
}
