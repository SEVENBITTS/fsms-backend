import type { NextFunction, Request, Response } from "express";
import { PlatformService } from "./platform.service";

type PlatformIdParams = {
  id: string;
};

export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  createPlatform = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const platform = await this.platformService.createPlatform(req.body);
      res.status(201).json({ platform });
    } catch (error) {
      next(error);
    }
  };

  getPlatform = async (
    req: Request<PlatformIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const platform = await this.platformService.getPlatform(req.params.id);
      res.status(200).json({ platform });
    } catch (error) {
      next(error);
    }
  };

  createMaintenanceSchedule = async (
    req: Request<PlatformIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const schedule = await this.platformService.createMaintenanceSchedule(
        req.params.id,
        req.body,
      );
      res.status(201).json({ schedule });
    } catch (error) {
      next(error);
    }
  };

  createMaintenanceRecord = async (
    req: Request<PlatformIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const record = await this.platformService.createMaintenanceRecord(
        req.params.id,
        req.body,
      );
      res.status(201).json({ record });
    } catch (error) {
      next(error);
    }
  };

  getMaintenanceStatus = async (
    req: Request<PlatformIdParams>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const status = await this.platformService.getMaintenanceStatus(req.params.id);
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  };
}
