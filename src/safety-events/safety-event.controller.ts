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
}
