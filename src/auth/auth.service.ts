import type { Pool } from "pg";
import { UsersRepository } from "../users/users.repository";
import { verifyPassword } from "../users/users.service";
import { AuthUnauthorizedError } from "./auth.errors";
import { AuthRepository } from "./auth.repository";
import type { LoginInput } from "./auth.types";
import { validateLoginInput } from "./auth.validators";

export class AuthService {
  private static readonly SESSION_TTL_MS = 1000 * 60 * 60 * 12;

  constructor(
    private readonly pool: Pool,
    private readonly authRepository: AuthRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async login(input: LoginInput | undefined) {
    const validated = validateLoginInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const user = await this.usersRepository.getUserByEmail(
        client,
        validated.email,
      );

      if (!user || !verifyPassword(validated.password, user.passwordHash)) {
        throw new AuthUnauthorizedError("Invalid email or password");
      }

      const expiresAt = new Date(Date.now() + AuthService.SESSION_TTL_MS);
      const session = await this.authRepository.createSession(client, {
        userId: user.id,
        expiresAt,
      });
      await this.usersRepository.updateLastLoginAt(client, user.id);

      await client.query("COMMIT");
      return {
        sessionToken: session.sessionToken,
        expiresAt: session.expiresAt,
        user: await this.usersRepository.getUserById(client, user.id),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async logout(sessionToken: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await this.authRepository.revokeSessionByToken(client, sessionToken);
    } finally {
      client.release();
    }
  }

  async resolveAuthenticatedUser(sessionToken: string) {
    const client = await this.pool.connect();

    try {
      const session = await this.authRepository.getSessionByToken(
        client,
        sessionToken,
      );

      if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date()) {
        throw new AuthUnauthorizedError();
      }

      const user = await this.usersRepository.getUserById(client, session.userId);

      if (!user || user.status !== "active") {
        throw new AuthUnauthorizedError();
      }

      return { user, expiresAt: session.expiresAt };
    } finally {
      client.release();
    }
  }
}
