import type { NextFunction, Request, Response } from "express";
import { AuthUnauthorizedError } from "./auth.errors";
import { AuthService } from "./auth.service";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getSessionToken(req: Request): string | null {
  const headerToken = firstValue(req.headers["x-session-token"]);
  if (headerToken?.trim()) {
    return headerToken.trim();
  }

  const authHeader = firstValue(req.headers.authorization);
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export function createAuthMiddleware(authService: AuthService) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const sessionToken = getSessionToken(req);
      if (!sessionToken) {
        throw new AuthUnauthorizedError();
      }

      const resolved = await authService.resolveAuthenticatedUser(sessionToken);
      (req as any).auth = {
        sessionToken,
        expiresAt: resolved.expiresAt,
      };
      (req as any).user = resolved.user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireCurrentUser(req: Request) {
  const user = (req as any).user;

  if (!user?.id) {
    throw new AuthUnauthorizedError();
  }

  return user as { id: string; email: string; displayName: string };
}

export function requireCurrentSessionToken(req: Request): string {
  const sessionToken = (req as any).auth?.sessionToken;

  if (!sessionToken) {
    throw new AuthUnauthorizedError();
  }

  return sessionToken as string;
}
