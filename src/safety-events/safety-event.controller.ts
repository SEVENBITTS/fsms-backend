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

  createAgendaLink = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const link = await this.safetyEventService.createAgendaLink(
        req.params.eventId,
        req.params.triggerId,
        req.body,
      );
      res.status(201).json({ link });
    } catch (error) {
      next(error);
    }
  };

  listAgendaLinks = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const links = await this.safetyEventService.listAgendaLinks(
        req.params.eventId,
      );
      res.status(200).json({ links });
    } catch (error) {
      next(error);
    }
  };

  createSafetyActionProposal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const proposal =
        await this.safetyEventService.createSafetyActionProposal(
          req.params.eventId,
          req.params.agendaLinkId,
          req.body,
        );
      res.status(201).json({ proposal });
    } catch (error) {
      next(error);
    }
  };

  listSafetyActionProposals = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const proposals =
        await this.safetyEventService.listSafetyActionProposals(
          req.params.eventId,
          req.params.agendaLinkId,
        );
      res.status(200).json({ proposals });
    } catch (error) {
      next(error);
    }
  };

  createSafetyActionDecision = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.safetyEventService.createSafetyActionDecision(
        req.params.eventId,
        req.params.agendaLinkId,
        req.params.proposalId,
        req.body,
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  listSafetyActionDecisions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const decisions =
        await this.safetyEventService.listSafetyActionDecisions(
          req.params.eventId,
          req.params.agendaLinkId,
          req.params.proposalId,
        );
      res.status(200).json({ decisions });
    } catch (error) {
      next(error);
    }
  };
}
