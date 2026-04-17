import type { NextFunction, Request, Response } from "express";
import { MissionReplayService } from "./mission-replay.service";

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

export class MissionReplayController {
  constructor(private readonly replayService: MissionReplayService) {}

  getMissionReplay = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const missionId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const result = await this.replayService.getMissionReplay(missionId, {
        from: firstQueryValue(req.query.from),
        to: firstQueryValue(req.query.to),
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
