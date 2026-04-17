import type { NextFunction, Request, Response } from "express";
import { PilotService } from "./pilot.service";

type PilotIdParams = {
  id: string;
};

export class PilotController {
  constructor(private readonly pilotService: PilotService) {}

  createPilot = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const pilot = await this.pilotService.createPilot(req.body);
      res.status(201).json({ pilot });
    } catch (error) {
      next(error);
    }
  };

  getPilot = async (
    req: Request<PilotIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const pilot = await this.pilotService.getPilot(req.params.id);
      res.status(200).json({ pilot });
    } catch (error) {
      next(error);
    }
  };

  createReadinessEvidence = async (
    req: Request<PilotIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const evidence = await this.pilotService.createReadinessEvidence(
        req.params.id,
        req.body,
      );
      res.status(201).json({ evidence });
    } catch (error) {
      next(error);
    }
  };

  getReadiness = async (
    req: Request<PilotIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const readiness = await this.pilotService.checkPilotReadiness(
        req.params.id,
      );
      res.status(200).json(readiness);
    } catch (error) {
      next(error);
    }
  };
}
