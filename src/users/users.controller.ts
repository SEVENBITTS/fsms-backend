import type { NextFunction, Request, Response } from "express";
import { UsersService } from "./users.service";

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  createUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const created = await this.usersService.createUser(req.body);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };
}
