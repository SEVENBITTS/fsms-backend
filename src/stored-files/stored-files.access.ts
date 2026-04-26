import type { Request } from "express";
import { HttpError } from "../utils/errors";

export type StoredFileActorRole =
  | "viewer"
  | "operator"
  | "operations_manager"
  | "compliance_manager"
  | "accountable_manager"
  | "admin";

const STORED_FILE_ACTOR_ROLES = new Set<StoredFileActorRole>([
  "viewer",
  "operator",
  "operations_manager",
  "compliance_manager",
  "accountable_manager",
  "admin",
]);

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function getStoredFileActorRole(
  req: Request,
): StoredFileActorRole | null {
  const queryRole =
    typeof req.query.actorRole === "string" ? req.query.actorRole : null;
  const headerRole = firstValue(req.headers["x-actor-role"]) ?? null;
  const candidate = (queryRole ?? headerRole)?.trim().toLowerCase();

  if (!candidate) {
    return null;
  }

  return STORED_FILE_ACTOR_ROLES.has(candidate as StoredFileActorRole)
    ? (candidate as StoredFileActorRole)
    : null;
}

export function requireStoredFileAccess(
  req: Request,
  allowedRoles: StoredFileActorRole[],
  actionLabel: string,
): StoredFileActorRole {
  const actorRole = getStoredFileActorRole(req);

  if (!actorRole) {
    throw new HttpError(
      403,
      `A recorded actor role is required before ${actionLabel}.`,
      "stored_file_role_required",
    );
  }

  if (!allowedRoles.includes(actorRole)) {
    throw new HttpError(
      403,
      `Role ${actorRole} is not currently permitted to ${actionLabel}.`,
      "stored_file_role_forbidden",
    );
  }

  return actorRole;
}
