import { OrganisationMembershipsValidationError } from "./organisation-memberships.errors";
import type {
  CreateOrganisationMembershipInput,
  OrganisationRole,
} from "./organisation-memberships.types";

const ROLES = new Set<OrganisationRole>([
  "viewer",
  "operator",
  "operations_manager",
  "compliance_manager",
  "accountable_manager",
  "admin",
]);

function requiredTrimmed(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new OrganisationMembershipsValidationError(
      `${fieldName} must be a string`,
    );
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new OrganisationMembershipsValidationError(
      `${fieldName} must not be empty`,
    );
  }
  return trimmed;
}

export function validateCreateOrganisationMembershipInput(
  input: CreateOrganisationMembershipInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new OrganisationMembershipsValidationError("Request body must be an object");
  }

  const role = requiredTrimmed(input.role, "role") as OrganisationRole;
  if (!ROLES.has(role)) {
    throw new OrganisationMembershipsValidationError("role is not supported");
  }

  return {
    userId: requiredTrimmed(input.userId, "userId"),
    role,
  };
}
