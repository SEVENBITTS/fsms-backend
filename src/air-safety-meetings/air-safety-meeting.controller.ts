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
}
