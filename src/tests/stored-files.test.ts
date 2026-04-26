import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const clearTables = async () => {
  await pool.query("delete from user_sessions");
  await pool.query("delete from organisation_memberships");
  await pool.query("delete from users");
  await pool.query("delete from stored_files");
  await pool.query("delete from organisation_documents");
  await pool.query("delete from operational_authority_pilot_authorisations");
  await pool.query("delete from insurance_conditions");
  await pool.query("delete from insurance_profiles");
  await pool.query("delete from insurance_documents");
  await pool.query("delete from operational_authority_conditions");
  await pool.query("delete from operational_authority_profiles");
  await pool.query("delete from operational_authority_documents");
};

const createUserAndSession = async (email: string) => {
  const createUserResponse = await request(app).post("/users").send({
    email,
    displayName: "Test User",
    password: "Password123!",
  });

  const loginResponse = await request(app).post("/auth/login").send({
    email,
    password: "Password123!",
  });

  return {
    user: createUserResponse.body.user,
    sessionToken: loginResponse.body.sessionToken,
  };
};

const createMembership = async (organisationId: string, userId: string, role: string) => {
  await request(app).post(`/organisations/${organisationId}/memberships`).send({
    userId,
    role,
  });
};

describe("stored file ingestion", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("stores uploaded binary content with checksum and metadata", async () => {
    const organisationId = randomUUID();
    const fileBuffer = Buffer.from("verityatlas-evidence-pack");
    const auth = await createUserAndSession("admin@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const uploadResponse = await request(app)
      .post(`/organisations/${organisationId}/files`)
      .set("Content-Type", "application/pdf")
      .set("X-File-Name", "evidence-pack.pdf")
      .set("X-Source-Document-Type", "evidence_pack")
      .set("X-Session-Token", auth.sessionToken)
      .set("X-Uploaded-By", "admin-user")
      .send(fileBuffer);

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.file).toMatchObject({
      organisationId,
      originalFileName: "evidence-pack.pdf",
      contentType: "application/pdf",
      sourceDocumentType: "evidence_pack",
      fileSizeBytes: fileBuffer.length,
      uploadedBy: "admin-user",
    });
    expect(uploadResponse.body.file.fileChecksum).toMatch(/^[a-f0-9]{64}$/);

    const filePath = path.resolve(
      process.cwd(),
      uploadResponse.body.file.storagePath,
    );
    const savedBuffer = await fs.readFile(filePath);
    expect(savedBuffer.equals(fileBuffer)).toBe(true);
  });

  it("returns metadata and downloadable content for a stored file", async () => {
    const organisationId = randomUUID();
    const fileBuffer = Buffer.from("policy wordings and endorsements");
    const admin = await createUserAndSession("admin2@example.com");
    const viewer = await createUserAndSession("viewer@example.com");
    const compliance = await createUserAndSession("compliance@example.com");
    const ops = await createUserAndSession("ops@example.com");
    await createMembership(organisationId, admin.user.id, "admin");
    await createMembership(organisationId, viewer.user.id, "viewer");
    await createMembership(organisationId, compliance.user.id, "compliance_manager");
    await createMembership(organisationId, ops.user.id, "operations_manager");

    const uploadResponse = await request(app)
      .post(`/organisations/${organisationId}/files`)
      .set("Content-Type", "text/plain")
      .set("X-File-Name", "policy.txt")
      .set("X-Session-Token", admin.sessionToken)
      .send(fileBuffer);

    const fileId = uploadResponse.body.file.id;

    const metadataResponse = await request(app)
      .get(`/files/${fileId}`)
      .set("X-Session-Token", viewer.sessionToken);
    expect(metadataResponse.status).toBe(200);
    expect(metadataResponse.body.file).toMatchObject({
      id: fileId,
      originalFileName: "policy.txt",
      fileSizeBytes: fileBuffer.length,
    });
    expect(metadataResponse.headers["x-organisation-role"]).toBe("viewer");

    const downloadResponse = await request(app)
      .get(`/files/${fileId}/content`)
      .set("X-Session-Token", compliance.sessionToken);
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers["content-type"]).toContain("text/plain");
    expect(downloadResponse.headers["content-disposition"]).toContain("attachment;");
    expect(downloadResponse.headers["x-organisation-role"]).toBe(
      "compliance_manager",
    );
    expect(downloadResponse.text).toBe("policy wordings and endorsements");

    const previewResponse = await request(app)
      .get(`/files/${fileId}/content?disposition=inline`)
      .set("X-Session-Token", ops.sessionToken);
    expect(previewResponse.status).toBe(200);
    expect(previewResponse.headers["content-disposition"]).toContain("inline;");
    expect(previewResponse.text).toBe("policy wordings and endorsements");
  });

  it("rejects content access when the actor role is too low for file content", async () => {
    const organisationId = randomUUID();
    const admin = await createUserAndSession("admin3@example.com");
    const viewer = await createUserAndSession("viewer2@example.com");
    await createMembership(organisationId, admin.user.id, "admin");
    await createMembership(organisationId, viewer.user.id, "viewer");

    const uploadResponse = await request(app)
      .post(`/organisations/${organisationId}/files`)
      .set("Content-Type", "text/plain")
      .set("X-File-Name", "ops-manual.txt")
      .set("X-Session-Token", admin.sessionToken)
      .send(Buffer.from("controlled content"));

    const fileId = uploadResponse.body.file.id;

    const response = await request(app)
      .get(`/files/${fileId}/content`)
      .set("X-Session-Token", viewer.sessionToken);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      type: "organisation_membership_forbidden",
    });
  });
});
