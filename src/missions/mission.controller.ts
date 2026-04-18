import { Request, Response, NextFunction } from "express";
import { MissionService } from "./mission.service";
import { InvalidMissionTransitionError } from "./errors";
import { MissionLifecycleAction } from "../modules/missions/domain/missionLifecycle";

const VALID_ACTIONS = new Set<MissionLifecycleAction>([
  "submit",
  "approve",
  "launch",
  "complete",
  "abort",
]);

export class MissionController {
  constructor(private readonly missionService: MissionService) {}

  getMissionEvents = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const missionId = this.requireUuid(req.params.missionId, "missionId");

      const filters = {
        safety: this.parseBoolean(req.query.safety),
        compliance: this.parseBoolean(req.query.compliance),
        severity: this.parseSeverity(req.query.severity),
        type: this.optionalString(req.query.type),
      };

      const events = await this.missionService.getMissionEvents(missionId, filters);

      res.status(200).json(events);
    } catch (error) {
      next(error);
    }
  };

  checkTransition = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const missionId = this.requireString(req.params.missionId, "missionId");
      const action = this.requireString(req.params.action, "action");

      if (!VALID_ACTIONS.has(action as MissionLifecycleAction)) {
        res.status(400).json({
          error: {
            type: "invalid_action",
            message: `Unsupported lifecycle action ${action}`,
          },
        });
        return;
      }

      const result = await this.missionService.checkMissionTransition({
        missionId,
        action: action as MissionLifecycleAction,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  checkReadiness = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const missionId = this.requireString(req.params.missionId, "missionId");
      const platformId = this.optionalString(req.query.platformId);
      const pilotId = this.optionalString(req.query.pilotId);

      const result = await this.missionService.checkMissionReadiness({
        missionId,
        platformId,
        pilotId,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  submitMission = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.missionService.submitMission({
        missionId: this.requireString(req.params.missionId, "missionId"),
        userId: this.requireString(
          (req as any).user?.id ?? req.body.userId,
          "userId",
        ),
        requestId: this.optionalString(req.headers["x-request-id"]),
        correlationId: this.optionalString(req.headers["x-correlation-id"]),
      });

      res.status(204).send();
    } catch (error) {
      this.handleControllerError(error, res, next);
    }
  };

  approveMission = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.missionService.approveMission({
        missionId: this.requireString(req.params.missionId, "missionId"),
        reviewerId: this.requireString(
          (req as any).user?.id ?? req.body.reviewerId,
          "reviewerId",
        ),
        decisionEvidenceLinkId: this.optionalString(req.body.decisionEvidenceLinkId),
        notes: this.optionalString(req.body.notes),
        requestId: this.optionalString(req.headers["x-request-id"]),
        correlationId: this.optionalString(req.headers["x-correlation-id"]),
      });

      res.status(204).send();
    } catch (error) {
      this.handleControllerError(error, res, next);
    }
  };

  launchMission = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.missionService.launchMission({
        missionId: this.requireString(req.params.missionId, "missionId"),
        operatorId: this.requireString(
          (req as any).user?.id ?? req.body.operatorId,
          "operatorId",
        ),
        vehicleId: this.requireString(req.body.vehicleId, "vehicleId"),
        lat: this.requireNumber(req.body.lat, "lat"),
        lng: this.requireNumber(req.body.lng, "lng"),
        requestId: this.optionalString(req.headers["x-request-id"]),
        correlationId: this.optionalString(req.headers["x-correlation-id"]),
      });

      res.status(204).send();
    } catch (error) {
      this.handleControllerError(error, res, next);
    }
  };

  completeMission = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.missionService.completeMission({
        missionId: this.requireString(req.params.missionId, "missionId"),
        operatorId: this.optionalString(
          (req as any).user?.id ?? req.body.operatorId,
        ),
      });

      res.status(204).send();
    } catch (error) {
      this.handleControllerError(error, res, next);
    }
  };

  abortMission = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.missionService.abortMission({
        missionId: this.requireString(req.params.missionId, "missionId"),
        actorId: this.optionalString((req as any).user?.id ?? req.body.actorId),
        reason: this.requireString(req.body.reason, "reason"),
      });

      res.status(204).send();
    } catch (error) {
      this.handleControllerError(error, res, next);
    }
  };

  private requireString(value: unknown, fieldName: string): string {
    const normalized = this.optionalString(value);

    if (!normalized) {
      throw new Error(`${fieldName} is required`);
    }

    return normalized;
  }

  private optionalString(value: unknown): string | undefined {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    if (Array.isArray(value)) {
      const first = value.find(
        (item) => typeof item === "string" && item.trim().length > 0,
      );
      return typeof first === "string" ? first.trim() : undefined;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return undefined;
  }

  private requireUuid(value: unknown, fieldName: string): string {
    const normalized = this.requireString(value, fieldName);

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(normalized)) {
      throw new Error(`${fieldName} must be a valid UUID`);
    }

    return normalized;
  }

  private parseBoolean(value: unknown): boolean | undefined {
    const normalized = this.optionalString(value)?.toLowerCase();

    if (!normalized) {
      return undefined;
    }

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }

    throw new Error(`Boolean query parameter must be 'true' or 'false'`);
  }

  private parseSeverity(
    value: unknown,
  ): "info" | "warning" | "critical" | undefined {
    const normalized = this.optionalString(value)?.toLowerCase();

    if (!normalized) {
      return undefined;
    }

    if (
      normalized === "info" ||
      normalized === "warning" ||
      normalized === "critical"
    ) {
      return normalized;
    }

    throw new Error(`severity must be one of: info, warning, critical`);
  }

  private handleControllerError(
    error: unknown,
    res: Response,
    next: NextFunction,
  ): void {
    if (error instanceof InvalidMissionTransitionError) {
      res.status(409).json({
        error: {
          type: "invalid_state_transition",
          message: error.message,
        },
      });
      return;
    }

    next(error);
  }

  private requireNumber(value: unknown, fieldName: string): number {
    const num =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : NaN;

    if (!Number.isFinite(num)) {
      throw new Error(`${fieldName} must be a valid number`);
    }

    return num;
  }
}
