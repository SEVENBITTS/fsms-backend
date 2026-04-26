import type { NextFunction, Request, Response } from "express";
import { requireCurrentSessionToken, requireCurrentUser } from "./auth.middleware";
import { AuthService } from "./auth.service";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.authService.login(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.authService.logout(requireCurrentSessionToken(req));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  me = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      res.status(200).json({ user: requireCurrentUser(req) });
    } catch (error) {
      next(error);
    }
  };
}
