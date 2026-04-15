import type { Request, Response, NextFunction } from "express";
import { AlertService } from "./alert.service";

type MissionIdParams = {
  id: string;
};

export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  getAlertsForMission = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const missionId = req.params.id;

      const alerts = await this.alertService.listAlertsForMission(missionId);

      return res.status(200).json({
        missionId,
        alerts,
      });
    } catch (error) {
      return next(error);
    }
  };
}