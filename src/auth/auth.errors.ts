export class AuthValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "AUTH_VALIDATION_FAILED";
}

export class AuthUnauthorizedError extends Error {
  readonly statusCode = 401;
  readonly code = "AUTH_UNAUTHORIZED";

  constructor(message = "Authentication required") {
    super(message);
  }
}
