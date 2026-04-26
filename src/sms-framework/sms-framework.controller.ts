import type { NextFunction, Request, Response } from "express";
import { SmsFrameworkService } from "./sms-framework.service";

export class SmsFrameworkController {
  constructor(private readonly smsFrameworkService: SmsFrameworkService) {}

  getFramework = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const framework = await this.smsFrameworkService.getFramework();
      res.status(200).json({ framework });
    } catch (error) {
      next(error);
    }
  };

  listControlMappings = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const mappings = await this.smsFrameworkService.listControlMappings();
      res.status(200).json({ mappings });
    } catch (error) {
      next(error);
    }
  };
}
