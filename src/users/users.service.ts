import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { Pool } from "pg";
import { UserConflictError } from "./users.errors";
import { UsersRepository } from "./users.repository";
import type { CreateUserInput } from "./users.types";
import { validateCreateUserInput } from "./users.validators";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, derived] = storedHash.split(":");
  if (!salt || !derived) {
    return false;
  }

  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(derived, "hex");

  if (candidate.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(candidate, expected);
}

export class UsersService {
  constructor(
    private readonly pool: Pool,
    private readonly usersRepository: UsersRepository,
  ) {}

  async createUser(input: CreateUserInput | undefined) {
    const validated = validateCreateUserInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await this.usersRepository.getUserByEmail(
        client,
        validated.email,
      );

      if (existing) {
        throw new UserConflictError(validated.email);
      }

      const user = await this.usersRepository.insertUser(client, {
        email: validated.email,
        displayName: validated.displayName,
        passwordHash: hashPassword(validated.password),
      });

      await client.query("COMMIT");
      return { user };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
