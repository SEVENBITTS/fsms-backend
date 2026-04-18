import type { NextFunction, Request, Response } from "express";
import { MissionPlanningService } from "./mission-planning.service";

type MissionIdParams = {
  missionId: string;
};

export class MissionPlanningController {
  constructor(private readonly missionPlanningService: MissionPlanningService) {}

  createDraft = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const draft = await this.missionPlanningService.createDraft(req.body);
      res.status(201).json({ draft });
    } catch (error) {
      next(error);
    }
  };

  getDraft = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const draft = await this.missionPlanningService.getDraft(
        req.params.missionId,
      );
      res.status(200).json({ draft });
    } catch (error) {
      next(error);
    }
  };
}
