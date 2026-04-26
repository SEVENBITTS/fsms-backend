import { AuthValidationError } from "./auth.errors";
import type { LoginInput } from "./auth.types";

function requiredTrimmed(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new AuthValidationError(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AuthValidationError(`${fieldName} must not be empty`);
  }
  return trimmed;
}

export function validateLoginInput(input: LoginInput | undefined) {
  if (!input || typeof input !== "object") {
    throw new AuthValidationError("Request body must be an object");
  }

  return {
    email: requiredTrimmed(input.email, "email").toLowerCase(),
    password: requiredTrimmed(input.password, "password"),
  };
}
