import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { User } from "./users.types";

interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  status: User["status"];
  mfa_state: User["mfaState"];
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  status: row.status,
  mfaState: row.mfa_state,
  lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class UsersRepository {
  async insertUser(
    tx: PoolClient,
    params: { email: string; displayName: string; passwordHash: string },
  ): Promise<User> {
    const result = await tx.query<UserRow>(
      `
      insert into users (
        id,
        email,
        display_name,
        password_hash,
        status,
        mfa_state
      )
      values ($1, $2, $3, $4, 'active', 'not_enabled')
      returning *
      `,
      [randomUUID(), params.email, params.displayName, params.passwordHash],
    );

    return toUser(result.rows[0]);
  }

  async getUserByEmail(
    tx: PoolClient,
    email: string,
  ): Promise<(User & { passwordHash: string }) | null> {
    const result = await tx.query<UserRow>(
      `
      select *
      from users
      where email = $1
      `,
      [email],
    );

    if (!result.rows[0]) {
      return null;
    }

    return {
      ...toUser(result.rows[0]),
      passwordHash: result.rows[0].password_hash,
    };
  }

  async getUserById(tx: PoolClient, userId: string): Promise<User | null> {
    const result = await tx.query<UserRow>(
      `
      select *
      from users
      where id = $1
      `,
      [userId],
    );

    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  async updateLastLoginAt(tx: PoolClient, userId: string): Promise<void> {
    await tx.query(
      `
      update users
      set
        last_login_at = now(),
        updated_at = now()
      where id = $1
      `,
      [userId],
    );
  }
}
