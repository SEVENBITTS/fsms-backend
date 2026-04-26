import { createHash, randomBytes, randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";

interface UserSessionRow extends QueryResultRow {
  id: string;
  user_id: string;
  session_token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

export class AuthRepository {
  static hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  static issueToken(): string {
    return randomBytes(24).toString("hex");
  }

  async createSession(
    tx: PoolClient,
    params: { userId: string; expiresAt: Date },
  ): Promise<{ sessionToken: string; expiresAt: string }> {
    const sessionToken = AuthRepository.issueToken();
    const tokenHash = AuthRepository.hashToken(sessionToken);

    await tx.query(
      `
      insert into user_sessions (
        id,
        user_id,
        session_token_hash,
        expires_at
      )
      values ($1, $2, $3, $4)
      `,
      [randomUUID(), params.userId, tokenHash, params.expiresAt.toISOString()],
    );

    return {
      sessionToken,
      expiresAt: params.expiresAt.toISOString(),
    };
  }

  async getSessionByToken(
    tx: PoolClient,
    token: string,
  ): Promise<{
    userId: string;
    expiresAt: string;
    revokedAt: string | null;
  } | null> {
    const result = await tx.query<UserSessionRow>(
      `
      select *
      from user_sessions
      where session_token_hash = $1
      `,
      [AuthRepository.hashToken(token)],
    );

    if (!result.rows[0]) {
      return null;
    }

    return {
      userId: result.rows[0].user_id,
      expiresAt: result.rows[0].expires_at.toISOString(),
      revokedAt: result.rows[0].revoked_at
        ? result.rows[0].revoked_at.toISOString()
        : null,
    };
  }

  async revokeSessionByToken(tx: PoolClient, token: string): Promise<void> {
    await tx.query(
      `
      update user_sessions
      set revoked_at = now()
      where session_token_hash = $1
        and revoked_at is null
      `,
      [AuthRepository.hashToken(token)],
    );
  }
}
