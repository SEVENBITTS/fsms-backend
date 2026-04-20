import type { NextFunction, Request, Response } from "express";
import { AirSafetyMeetingService } from "./air-safety-meeting.service";

export class AirSafetyMeetingController {
  constructor(
    private readonly airSafetyMeetingService: AirSafetyMeetingService,
  ) {}

  createAirSafetyMeeting = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const meeting =
        await this.airSafetyMeetingService.createAirSafetyMeeting(req.body);
      res.status(201).json({ meeting });
    } catch (error) {
      next(error);
    }
  };

  listAirSafetyMeetings = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const meetings =
        await this.airSafetyMeetingService.listAirSafetyMeetings();
      res.status(200).json({ meetings });
    } catch (error) {
      next(error);
    }
  };

  exportAirSafetyMeetingApprovalRollup = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const rollup =
        await this.airSafetyMeetingService.exportAirSafetyMeetingApprovalRollup();
      res.status(200).json({ export: rollup });
    } catch (error) {
      next(error);
    }
  };

  renderAirSafetyMeetingApprovalRollup = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const report =
        await this.airSafetyMeetingService.renderAirSafetyMeetingApprovalRollup();
      res.status(200).json({ report });
    } catch (error) {
      next(error);
    }
  };

  generateAirSafetyMeetingApprovalRollupPdf = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const pdf =
        await this.airSafetyMeetingService.generateAirSafetyMeetingApprovalRollupPdf();
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

  createGovernanceApprovalRollupSignoff = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signoff =
        await this.airSafetyMeetingService.createGovernanceApprovalRollupSignoff(
          req.body,
        );
      res.status(201).json({ signoff });
    } catch (error) {
      next(error);
    }
  };

  listGovernanceApprovalRollupSignoffs = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signoffs =
        await this.airSafetyMeetingService.listGovernanceApprovalRollupSignoffs();
      res.status(200).json({ signoffs });
    } catch (error) {
      next(error);
    }
  };

  createAirSafetyMeetingSignoff = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signoff =
        await this.airSafetyMeetingService.createAirSafetyMeetingSignoff(
          req.params.meetingId,
          req.body,
        );
      res.status(201).json({ signoff });
    } catch (error) {
      next(error);
    }
  };

  listAirSafetyMeetingSignoffs = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signoffs =
        await this.airSafetyMeetingService.listAirSafetyMeetingSignoffs(
          req.params.meetingId,
        );
      res.status(200).json({ signoffs });
    } catch (error) {
      next(error);
    }
  };

  getQuarterlyCompliance = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const compliance =
        await this.airSafetyMeetingService.getQuarterlyCompliance({
          asOf: req.query.asOf,
        });
      res.status(200).json({ compliance });
    } catch (error) {
      next(error);
    }
  };

  exportAirSafetyMeetingPack = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const meetingExport =
        await this.airSafetyMeetingService.exportAirSafetyMeetingPack(
          req.params.meetingId,
        );
      res.status(200).json({ export: meetingExport });
    } catch (error) {
      next(error);
    }
  };

  renderAirSafetyMeetingPack = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const report =
        await this.airSafetyMeetingService.renderAirSafetyMeetingPack(
          req.params.meetingId,
        );
      res.status(200).json({ report });
    } catch (error) {
      next(error);
    }
  };

  generateAirSafetyMeetingPackPdf = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const pdf =
        await this.airSafetyMeetingService.generateAirSafetyMeetingPackPdf(
          req.params.meetingId,
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
}
