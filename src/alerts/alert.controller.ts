import type { Request, Response, NextFunction } from "express";
import { AlertService } from "./alert.service";
import {
  validateAcknowledgeAlertInput,
  validateRegulatoryAmendmentAlertInput,
  validateResolveAlertInput,
} from "./alert.validators";

type MissionIdParams = {
  id: string;
};

type MissionAlertParams = MissionIdParams & {
  alertId: string;
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

  createRegulatoryAmendmentAlert = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const missionId = req.params.id;
      const input = validateRegulatoryAmendmentAlertInput(req.body);
      const result = await this.alertService.recordRegulatoryAmendmentImpact(
        missionId,
        input,
      );

      return res.status(result.duplicate ? 200 : 201).json({
        missionId,
        duplicate: result.duplicate,
        alerts: result.created,
      });
    } catch (error) {
      return next(error);
    }
  };

  getRegulatoryReviewImpact = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const missionId = req.params.id;
      const impact = await this.alertService.getRegulatoryReviewImpact(missionId);

      return res.status(200).json(impact);
    } catch (error) {
      return next(error);
    }
  };

  acknowledgeAlert = async (
    req: Request<MissionAlertParams>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const input = validateAcknowledgeAlertInput(req.body);
      const alert = await this.alertService.acknowledgeAlertForMission(
        req.params.id,
        req.params.alertId,
        input,
      );

      return res.status(200).json({
        missionId: req.params.id,
        alert,
      });
    } catch (error) {
      return next(error);
    }
  };

  resolveAlert = async (
    req: Request<MissionAlertParams>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const input = validateResolveAlertInput(req.body);
      const alert = await this.alertService.resolveAlertForMission(
        req.params.id,
        req.params.alertId,
        input,
      );

      return res.status(200).json({
        missionId: req.params.id,
        alert,
      });
    } catch (error) {
      return next(error);
    }
  };
}
