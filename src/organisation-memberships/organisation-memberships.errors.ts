export class OrganisationMembershipsValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "ORGANISATION_MEMBERSHIPS_VALIDATION_FAILED";
}

export class OrganisationMembershipForbiddenError extends Error {
  readonly statusCode = 403;
  readonly code = "ORGANISATION_MEMBERSHIP_FORBIDDEN";

  constructor(message: string) {
    super(message);
  }
}
