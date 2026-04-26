import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from user_sessions");
  await pool.query("delete from organisation_memberships");
  await pool.query("delete from users");
};

describe("auth session flow", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a user, logs in, resolves /auth/me, and revokes the session on logout", async () => {
    const createUserResponse = await request(app).post("/users").send({
      email: "auth-user@example.com",
      displayName: "Auth User",
      password: "Password123!",
    });

    expect(createUserResponse.status).toBe(201);
    expect(createUserResponse.body.user).toMatchObject({
      email: "auth-user@example.com",
      displayName: "Auth User",
      status: "active",
    });

    const loginResponse = await request(app).post("/auth/login").send({
      email: "auth-user@example.com",
      password: "Password123!",
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toMatchObject({
      sessionToken: expect.any(String),
      user: expect.objectContaining({
        email: "auth-user@example.com",
      }),
    });

    const sessionToken = loginResponse.body.sessionToken as string;

    const meResponse = await request(app)
      .get("/auth/me")
      .set("X-Session-Token", sessionToken);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toMatchObject({
      user: expect.objectContaining({
        email: "auth-user@example.com",
        displayName: "Auth User",
      }),
    });

    const logoutResponse = await request(app)
      .post("/auth/logout")
      .set("X-Session-Token", sessionToken);

    expect(logoutResponse.status).toBe(204);

    const meAfterLogoutResponse = await request(app)
      .get("/auth/me")
      .set("X-Session-Token", sessionToken);

    expect(meAfterLogoutResponse.status).toBe(401);
    expect(meAfterLogoutResponse.body.error).toMatchObject({
      type: "auth_unauthorized",
    });
  });
});
