import type { NextFunction, Request, Response } from "express";
import { MissionTelemetryService } from "./mission-telemetry.service";

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

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

  getTelemetryHistory = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const missionId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const from = firstQueryValue(req.query.from);
      const to = firstQueryValue(req.query.to);
      const limitRaw = firstQueryValue(req.query.limit);

      const result = await this.telemetryService.getTelemetryHistory(
        missionId,
        {
          from,
          to,
          limit: limitRaw !== undefined ? Number(limitRaw) : undefined,
        },
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}