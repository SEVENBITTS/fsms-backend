import type { NextFunction, Request, Response } from "express";
import { ExternalOverlayService } from "./external-overlay.service";
import type { ExternalOverlayKind } from "./external-overlay.types";

type MissionIdParams = {
  missionId: string;
};

export class ExternalOverlayController {
  constructor(
    private readonly externalOverlayService: ExternalOverlayService,
  ) {}

  createExternalOverlay = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (req.body?.kind !== "weather") {
        throw new Error("Only weather overlays are supported in the first implementation slice");
      }

      const overlay = await this.externalOverlayService.createWeatherOverlay(
        req.params.missionId,
        req.body,
      );

      res.status(201).json({ overlay });
    } catch (error) {
      next(error);
    }
  };

  listExternalOverlays = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const kind =
        typeof req.query.kind === "string"
          ? (req.query.kind as ExternalOverlayKind)
          : undefined;

      const result = await this.externalOverlayService.listExternalOverlays(
        req.params.missionId,
        { kind },
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
