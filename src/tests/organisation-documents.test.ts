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
  await pool.query("delete from mission_events");
  await pool.query("delete from missions");
};

const buildDateWindow = (effectiveOffsetDays: number, expiryOffsetDays: number) => {
  const now = Date.now();

  return {
    issueDate: new Date(now + (effectiveOffsetDays - 7) * 24 * 60 * 60 * 1000)
      .toISOString(),
    effectiveFrom: new Date(now + effectiveOffsetDays * 24 * 60 * 60 * 1000)
      .toISOString(),
    expiresAt: new Date(now + expiryOffsetDays * 24 * 60 * 60 * 1000)
      .toISOString(),
  };
};

const createUserAndSession = async (email: string) => {
  const createUserResponse = await request(app).post("/users").send({
    email,
    displayName: "Docs Test User",
    password: "Password123!",
  });

  const loginResponse = await request(app).post("/auth/login").send({
    email,
    password: "Password123!",
  });

  return {
    user: createUserResponse.body.user,
    sessionToken: loginResponse.body.sessionToken as string,
  };
};

const createMembership = async (organisationId: string, userId: string, role: string) => {
  await request(app).post(`/organisations/${organisationId}/memberships`).send({
    userId,
    role,
  });
};

const createPilot = async (displayName = "Portal Pilot") => {
  const response = await request(app).post("/pilots").send({
    displayName,
    status: "active",
  });

  expect(response.status).toBe(201);
  return response.body.pilot as { id: string; displayName: string };
};

describe("organisation document portal", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await clearTables();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates and uploads a supporting organisation document", async () => {
    const organisationId = randomUUID();
    const auth = await createUserAndSession("docs-create@example.com");
    await createMembership(organisationId, auth.user.id, "admin");

    const createResponse = await request(app)
      .post(`/organisations/${organisationId}/documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        category: "certificate",
        title: "Remote Pilot Competency Certificate",
        issuingBody: "Training Provider",
        referenceNumber: "CERT-001",
        issueDate: new Date().toISOString(),
        effectiveFrom: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ["competency", "renewal"],
        uploadedBy: "admin-user",
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.document).toMatchObject({
      organisationId,
      category: "certificate",
      title: "Remote Pilot Competency Certificate",
      uploadedFileId: null,
    });

    const uploadResponse = await request(app)
      .post(`/organisation-documents/${createResponse.body.document.id}/upload`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        uploadedFileId: "file-supporting-001",
        sourceDocumentType: "pdf",
        uploadedFileName: "pilot-certificate.pdf",
        uploadedFileChecksum: "sha256:support001",
        reviewNotes: "Current pilot competency evidence for accountable review.",
        uploadedBy: "admin-user",
      });

    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.body.document).toMatchObject({
      id: createResponse.body.document.id,
      status: "active",
      uploadedFileId: "file-supporting-001",
      uploadedFileName: "pilot-certificate.pdf",
    });
  });

  it("returns a combined portal view with OA, insurance, and supporting records", async () => {
    const organisationId = randomUUID();
    const oaValidity = buildDateWindow(-10, 20);
    const insuranceValidity = buildDateWindow(-10, 45);
    const auth = await createUserAndSession("docs-portal@example.com");
    const pilot = await createPilot("Portal Pilot");
    await createMembership(organisationId, auth.user.id, "admin");

    const oaCreateResponse = await request(app)
      .post(`/organisations/${organisationId}/operational-authority-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        authorityName: "CAA",
        referenceNumber: "OA-PORTAL-001",
        issueDate: oaValidity.issueDate,
        effectiveFrom: oaValidity.effectiveFrom,
        expiresAt: oaValidity.expiresAt,
        uploadedBy: "compliance-lead",
        conditions: [],
      });

    await request(app)
      .post(`/operational-authority-documents/${oaCreateResponse.body.document.id}/upload`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        uploadedFileId: "file-oa-portal-001",
        sourceDocumentType: "operational_authorisation_pdf",
        uploadedFileName: "oa-portal.pdf",
        uploadedFileChecksum: "sha256:oa001",
        sourceClauseRefs: ["Section 1"],
        documentReviewNotes: "OA source uploaded.",
        uploadedBy: "compliance-lead",
      });

    const insuranceCreateResponse = await request(app)
      .post(`/organisations/${organisationId}/insurance-documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        providerName: "Aviation Mutual",
        policyNumber: "POL-PORTAL-001",
        issueDate: insuranceValidity.issueDate,
        effectiveFrom: insuranceValidity.effectiveFrom,
        expiresAt: insuranceValidity.expiresAt,
        uploadedBy: "ops-manager",
        conditions: [],
      });

    await request(app)
      .post(`/insurance-documents/${insuranceCreateResponse.body.document.id}/upload`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        uploadedFileId: "file-insurance-portal-001",
        sourceDocumentType: "policy_schedule",
        uploadedFileName: "insurance-portal.pdf",
        uploadedFileChecksum: "sha256:ins001",
        policyScheduleRefs: ["Schedule 1"],
        documentReviewNotes: "Insurance source uploaded.",
        uploadedBy: "ops-manager",
      });

    const supportingCreateResponse = await request(app)
      .post(`/organisations/${organisationId}/documents`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        category: "manual",
        title: "Operations Manual",
      issuingBody: "VerityAir Systems Ltd",
        referenceNumber: "MAN-001",
        issueDate: new Date().toISOString(),
        effectiveFrom: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ["manual"],
        uploadedBy: "admin-user",
      });

    await request(app)
      .post(`/organisation-documents/${supportingCreateResponse.body.document.id}/upload`)
      .set("X-Session-Token", auth.sessionToken)
      .send({
        uploadedFileId: "file-manual-001",
        sourceDocumentType: "pdf",
        uploadedFileName: "operations-manual.pdf",
        uploadedFileChecksum: "sha256:manual001",
        reviewNotes: "Current signed operations manual.",
        uploadedBy: "admin-user",
      });

    const portalResponse = await request(app).get(
      `/organisations/${organisationId}/document-portal`,
    ).set("X-Session-Token", auth.sessionToken);

    expect(portalResponse.status).toBe(200);
    expect(portalResponse.body).toMatchObject({
      organisationId,
      summary: expect.objectContaining({
        totalDocuments: 3,
        operationalAuthorityDocuments: 1,
        insuranceDocuments: 1,
        supportingDocuments: 1,
        missingSourceUploads: 0,
      }),
      sections: {
        operationalAuthorityDocuments: [
          expect.objectContaining({
            id: oaCreateResponse.body.document.id,
            uploadedFileId: "file-oa-portal-001",
          }),
        ],
        insuranceDocuments: [
          expect.objectContaining({
            id: insuranceCreateResponse.body.document.id,
            uploadedFileId: "file-insurance-portal-001",
          }),
        ],
        supportingDocuments: [
          expect.objectContaining({
            id: supportingCreateResponse.body.document.id,
            uploadedFileId: "file-manual-001",
          }),
        ],
        pilots: [
          expect.objectContaining({
            id: pilot.id,
            displayName: "Portal Pilot",
          }),
        ],
      },
    });
  });

  it("rejects document portal access when the authenticated user is outside the organisation", async () => {
    const organisationId = randomUUID();
    const member = await createUserAndSession("docs-member@example.com");
    const outsider = await createUserAndSession("docs-outsider@example.com");
    await createMembership(organisationId, member.user.id, "admin");

    const response = await request(app)
      .get(`/organisations/${organisationId}/document-portal`)
      .set("X-Session-Token", outsider.sessionToken);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      type: "organisation_membership_forbidden",
    });
  });
});
