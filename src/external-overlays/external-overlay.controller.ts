import type { NextFunction, Request, Response } from "express";
import { ExternalOverlayService } from "./external-overlay.service";
import type { ExternalOverlayKind } from "./external-overlay.types";

type MissionIdParams = {
  missionId: string;
};

type RefreshRunQuery = {
  refreshRunId?: string;
  fromRefreshRunId?: string;
  toRefreshRunId?: string;
  transitionFromRefreshRunId?: string;
  transitionToRefreshRunId?: string;
  transitionArtifact?: string;
  transitionArtifactId?: string;
  transitionArtifactChronology?: string;
  transitionArtifactIds?: string;
  transitionArtifactOffset?: string;
  transitionArtifactLimit?: string;
  transitionArtifactCursor?: string;
  transitionArtifactBookmark?: string;
  chronology?: string;
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

  listAreaOverlayRefreshRuns = async (
    req: Request<MissionIdParams, unknown, unknown, RefreshRunQuery>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const refreshRunId =
        typeof req.query.refreshRunId === "string" &&
        req.query.refreshRunId.trim().length > 0
          ? req.query.refreshRunId.trim()
          : undefined;
      const fromRefreshRunId =
        typeof req.query.fromRefreshRunId === "string" &&
        req.query.fromRefreshRunId.trim().length > 0
          ? req.query.fromRefreshRunId.trim()
          : undefined;
      const toRefreshRunId =
        typeof req.query.toRefreshRunId === "string" &&
        req.query.toRefreshRunId.trim().length > 0
          ? req.query.toRefreshRunId.trim()
          : undefined;
      const transitionFromRefreshRunId =
        typeof req.query.transitionFromRefreshRunId === "string" &&
        req.query.transitionFromRefreshRunId.trim().length > 0
          ? req.query.transitionFromRefreshRunId.trim()
          : undefined;
      const transitionToRefreshRunId =
        typeof req.query.transitionToRefreshRunId === "string" &&
        req.query.transitionToRefreshRunId.trim().length > 0
          ? req.query.transitionToRefreshRunId.trim()
          : undefined;
      const chronology =
        typeof req.query.chronology === "string" &&
        ["1", "true", "yes"].includes(req.query.chronology.trim().toLowerCase());
      const transitionArtifact =
        typeof req.query.transitionArtifact === "string" &&
        ["1", "true", "yes"].includes(
          req.query.transitionArtifact.trim().toLowerCase(),
        );
      const transitionArtifactId =
        typeof req.query.transitionArtifactId === "string" &&
        req.query.transitionArtifactId.trim().length > 0
          ? req.query.transitionArtifactId.trim()
          : undefined;
      const transitionArtifactChronology =
        typeof req.query.transitionArtifactChronology === "string" &&
        ["1", "true", "yes"].includes(
          req.query.transitionArtifactChronology.trim().toLowerCase(),
        );
      const transitionArtifactIds =
        typeof req.query.transitionArtifactIds === "string" &&
        req.query.transitionArtifactIds.trim().length > 0
          ? req.query.transitionArtifactIds
              .split(",")
              .map((value) => value.trim())
              .filter((value) => value.length > 0)
          : undefined;
      const transitionArtifactOffset =
        typeof req.query.transitionArtifactOffset === "string" &&
        req.query.transitionArtifactOffset.trim().length > 0
          ? req.query.transitionArtifactOffset.trim()
          : undefined;
      const transitionArtifactLimit =
        typeof req.query.transitionArtifactLimit === "string" &&
        req.query.transitionArtifactLimit.trim().length > 0
          ? req.query.transitionArtifactLimit.trim()
          : undefined;
      const transitionArtifactCursor =
        typeof req.query.transitionArtifactCursor === "string" &&
        req.query.transitionArtifactCursor.trim().length > 0
          ? req.query.transitionArtifactCursor.trim()
          : undefined;
      const transitionArtifactBookmark =
        typeof req.query.transitionArtifactBookmark === "string" &&
        req.query.transitionArtifactBookmark.trim().length > 0
          ? req.query.transitionArtifactBookmark.trim()
          : undefined;

      if (transitionArtifactChronology) {
        const result =
          await this.externalOverlayService.listAreaOverlayRefreshRunTransitionArtifacts(
            req.params.missionId,
            {
              refreshRunId,
              fromRefreshRunId,
              toRefreshRunId,
              chronology,
              transitionArtifact,
              transitionFromRefreshRunId,
              transitionToRefreshRunId,
              transitionArtifactId,
              transitionArtifactIds,
              transitionArtifactOffset,
              transitionArtifactLimit,
              transitionArtifactCursor,
              transitionArtifactBookmark,
            },
          );

        res.status(200).json(result);
        return;
      }

      if (transitionArtifact) {
        const result =
          await this.externalOverlayService.getAreaOverlayRefreshRunTransitionArtifact(
            req.params.missionId,
            {
              refreshRunId,
              fromRefreshRunId,
              toRefreshRunId,
              chronology,
              transitionFromRefreshRunId,
              transitionToRefreshRunId,
              transitionArtifactId,
            },
          );

        res.status(200).json(result);
        return;
      }

      if (transitionFromRefreshRunId || transitionToRefreshRunId) {
        const result =
          await this.externalOverlayService.getAreaOverlayRefreshRunTransition(
            req.params.missionId,
            {
              refreshRunId,
              fromRefreshRunId,
              toRefreshRunId,
              chronology,
              transitionFromRefreshRunId,
              transitionToRefreshRunId,
            },
          );

        res.status(200).json(result);
        return;
      }

      if (chronology) {
        const result =
          await this.externalOverlayService.listAreaOverlayRefreshRunChronology(
            req.params.missionId,
            {
              refreshRunId,
              fromRefreshRunId,
              toRefreshRunId,
            },
          );

        res.status(200).json(result);
        return;
      }

      if (fromRefreshRunId || toRefreshRunId) {
        const result =
          await this.externalOverlayService.diffAreaOverlayRefreshRuns(
            req.params.missionId,
            {
              fromRefreshRunId,
              toRefreshRunId,
            },
          );

        res.status(200).json(result);
        return;
      }

      const result =
        await this.externalOverlayService.listAreaOverlayRefreshRuns(
          req.params.missionId,
          { refreshRunId },
        );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
