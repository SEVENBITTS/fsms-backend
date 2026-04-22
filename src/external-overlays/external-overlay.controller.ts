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
      let overlay;

      if (req.body?.kind === "weather") {
        overlay = await this.externalOverlayService.createWeatherOverlay(
          req.params.missionId,
          req.body,
        );
      } else if (req.body?.kind === "crewed_traffic") {
        overlay = await this.externalOverlayService.createCrewedTrafficOverlay(
          req.params.missionId,
          req.body,
        );
      } else if (req.body?.kind === "drone_traffic") {
        overlay = await this.externalOverlayService.createDroneTrafficOverlay(
          req.params.missionId,
          req.body,
        );
      } else if (req.body?.kind === "area_conflict") {
        overlay = await this.externalOverlayService.createAreaConflictOverlay(
          req.params.missionId,
          req.body,
        );
      } else {
        throw new Error(
          "Supported overlay kinds are: weather, crewed_traffic, drone_traffic, area_conflict",
        );
      }

      res.status(201).json({ overlay });
    } catch (error) {
      next(error);
    }
  };

  normalizeAreaOverlaySources = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result =
        await this.externalOverlayService.normalizeAreaOverlaySources(
          req.params.missionId,
          req.body,
        );

      res.status(201).json(result);
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
