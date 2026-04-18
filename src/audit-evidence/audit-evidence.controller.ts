import type { NextFunction, Request, Response } from "express";
import { AuditEvidenceService } from "./audit-evidence.service";

type MissionIdParams = {
  missionId: string;
};

export class AuditEvidenceController {
  constructor(private readonly auditEvidenceService: AuditEvidenceService) {}

  createMissionReadinessSnapshot = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const snapshot =
        await this.auditEvidenceService.createMissionReadinessSnapshot(
          req.params.missionId,
          req.body,
        );
      res.status(201).json({ snapshot });
    } catch (error) {
      next(error);
    }
  };

  listMissionReadinessSnapshots = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const snapshots =
        await this.auditEvidenceService.listMissionReadinessSnapshots(
          req.params.missionId,
        );
      res.status(200).json({ snapshots });
    } catch (error) {
      next(error);
    }
  };
}
