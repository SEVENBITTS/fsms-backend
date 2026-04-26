import { Router, type RequestHandler } from "express";
import { AuthController } from "./auth.controller";

export function createAuthRouter(
  controller: AuthController,
  authMiddleware: RequestHandler,
): Router {
  const router = Router();

  router.post("/login", controller.login);
  router.post("/logout", authMiddleware, controller.logout);
  router.get("/me", authMiddleware, controller.me);

  return router;
}
