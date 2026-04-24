import type { NextFunction, Request, Response } from "express";
import { AuditEvidenceService } from "./audit-evidence.service";

type MissionIdParams = {
  missionId: string;
};

type PostOperationSnapshotParams = MissionIdParams & {
  snapshotId: string;
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

  createMissionDecisionEvidenceLink = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const link =
        await this.auditEvidenceService.createMissionDecisionEvidenceLink(
          req.params.missionId,
          req.body,
        );
      res.status(201).json({ link });
    } catch (error) {
      next(error);
    }
  };

  listMissionDecisionEvidenceLinks = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const links =
        await this.auditEvidenceService.listMissionDecisionEvidenceLinks(
          req.params.missionId,
        );
      res.status(200).json({ links });
    } catch (error) {
      next(error);
    }
  };

  createConflictGuidanceAcknowledgement = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const acknowledgement =
        await this.auditEvidenceService.createConflictGuidanceAcknowledgement(
          req.params.missionId,
          req.body,
        );
      res.status(201).json({ acknowledgement });
    } catch (error) {
      next(error);
    }
  };

  listConflictGuidanceAcknowledgements = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const acknowledgements =
        await this.auditEvidenceService.listConflictGuidanceAcknowledgements(
          req.params.missionId,
        );
      res.status(200).json({ acknowledgements });
    } catch (error) {
      next(error);
    }
  };

  createPostOperationEvidenceSnapshot = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const snapshot =
        await this.auditEvidenceService.createPostOperationEvidenceSnapshot(
          req.params.missionId,
          req.body,
        );
      res.status(201).json({ snapshot });
    } catch (error) {
      next(error);
    }
  };

  listPostOperationEvidenceSnapshots = async (
    req: Request<MissionIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const snapshots =
        await this.auditEvidenceService.listPostOperationEvidenceSnapshots(
          req.params.missionId,
        );
      res.status(200).json({ snapshots });
    } catch (error) {
      next(error);
    }
  };

  exportPostOperationEvidenceSnapshot = async (
    req: Request<PostOperationSnapshotParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const evidenceExport =
        await this.auditEvidenceService.exportPostOperationEvidenceSnapshot(
          req.params.missionId,
          req.params.snapshotId,
        );
      res.status(200).json({ export: evidenceExport });
    } catch (error) {
      next(error);
    }
  };

  renderPostOperationEvidenceSnapshot = async (
    req: Request<PostOperationSnapshotParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const report =
        await this.auditEvidenceService.renderPostOperationEvidenceSnapshot(
          req.params.missionId,
          req.params.snapshotId,
        );
      res.status(200).json({ report });
    } catch (error) {
      next(error);
    }
  };

  getPostOperationEvidenceReadiness = async (
    req: Request<PostOperationSnapshotParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const readiness =
        await this.auditEvidenceService.getPostOperationEvidenceReadiness(
          req.params.missionId,
          req.params.snapshotId,
        );
      res.status(200).json({ readiness });
    } catch (error) {
      next(error);
    }
  };

  generatePostOperationEvidencePdf = async (
    req: Request<PostOperationSnapshotParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const pdf =
        await this.auditEvidenceService.generatePostOperationEvidencePdf(
          req.params.missionId,
          req.params.snapshotId,
        );
      res
        .status(200)
        .setHeader("Content-Type", pdf.contentType)
        .setHeader(
          "Content-Disposition",
          `attachment; filename="${pdf.fileName}"`,
        )
        .setHeader("Content-Length", pdf.content.byteLength.toString())
        .send(pdf.content);
    } catch (error) {
      next(error);
    }
  };

  createPostOperationAuditSignoff = async (
    req: Request<PostOperationSnapshotParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signoff =
        await this.auditEvidenceService.createPostOperationAuditSignoff(
          req.params.missionId,
          req.params.snapshotId,
          req.body,
        );
      res.status(201).json({ signoff });
    } catch (error) {
      next(error);
    }
  };
}
