export class UsersValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "USERS_VALIDATION_FAILED";
}

export class UserNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "USER_NOT_FOUND";

  constructor(userId: string) {
    super(`User not found: ${userId}`);
  }
}

export class UserConflictError extends Error {
  readonly statusCode = 409;
  readonly code = "USER_CONFLICT";

  constructor(email: string) {
    super(`User already exists for email: ${email}`);
  }
}
