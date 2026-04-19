import type { NextFunction, Request, Response } from "express";
import { SafetyEventService } from "./safety-event.service";

export class SafetyEventController {
  constructor(private readonly safetyEventService: SafetyEventService) {}

  createSafetyEvent = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const event = await this.safetyEventService.createSafetyEvent(req.body);
      res.status(201).json({ event });
    } catch (error) {
      next(error);
    }
  };

  listSafetyEvents = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const events = await this.safetyEventService.listSafetyEvents();
      res.status(200).json({ events });
    } catch (error) {
      next(error);
    }
  };

  assessMeetingTrigger = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const trigger = await this.safetyEventService.assessMeetingTrigger(
        req.params.eventId,
        req.body,
      );
      res.status(201).json({ trigger });
    } catch (error) {
      next(error);
    }
  };

  listMeetingTriggers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const triggers = await this.safetyEventService.listMeetingTriggers(
        req.params.eventId,
      );
      res.status(200).json({ triggers });
    } catch (error) {
      next(error);
    }
  };
}
