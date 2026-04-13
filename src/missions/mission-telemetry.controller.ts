import type { NextFunction, Request, Response } from "express";
import { MissionTelemetryService } from "./mission-telemetry.service";

export class MissionTelemetryController {
  constructor(private readonly telemetryService: MissionTelemetryService) {}

  recordTelemetry = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const missionId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const result = await this.telemetryService.recordTelemetry(
        missionId,
        req.body,
      );

      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  };

  getLatestTelemetry = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const missionId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const result = await this.telemetryService.getLatestTelemetry(missionId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}