import { UsersValidationError } from "./users.errors";
import type { CreateUserInput } from "./users.types";

function requiredTrimmed(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new UsersValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new UsersValidationError(`${fieldName} must not be empty`);
  }

  return trimmed;
}

export function validateCreateUserInput(input: CreateUserInput | undefined) {
  if (!input || typeof input !== "object") {
    throw new UsersValidationError("Request body must be an object");
  }

  const email = requiredTrimmed(input.email, "email").toLowerCase();
  if (!email.includes("@")) {
    throw new UsersValidationError("email must be valid");
  }

  const password = requiredTrimmed(input.password, "password");
  if (password.length < 10) {
    throw new UsersValidationError("password must be at least 10 characters");
  }

  return {
    email,
    displayName: requiredTrimmed(input.displayName, "displayName"),
    password,
  };
}
