import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

const countFrameworkRows = async () => {
  const result = await pool.query(
    `
    select
      (select count(*)::int from sms_framework_sources) as source_count,
      (select count(*)::int from sms_pillars) as pillar_count,
      (select count(*)::int from sms_elements) as element_count,
      (select count(*)::int from sms_controls) as control_count,
      (select count(*)::int from sms_control_element_mappings) as mapping_count,
      (select count(*)::int from regulatory_requirement_mappings) as regulatory_mapping_count
    `,
  );

  return result.rows[0] as {
    source_count: number;
    pillar_count: number;
    element_count: number;
    control_count: number;
    mapping_count: number;
    regulatory_mapping_count: number;
  };
};

describe("SMS framework reference data", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("lists the seeded SMS sources, pillars, and elements in stable order", async () => {
    const before = await countFrameworkRows();

    const response = await request(app).get("/sms/framework");

    expect(response.status).toBe(200);
    expect(response.body.framework.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "UAV_SMS_WORKBOOK",
        sourceType: "internal_reference",
        title: "UAV SMS 4 Pillars and 12 Elements workbook",
      }),
      expect.objectContaining({
        code: "CAA_CAP_722A_2022",
        sourceType: "external_guidance_reference",
        versionLabel: "Version 2, 07-Dec-2022",
      }),
      expect.objectContaining({
        code: "CAA_CAP_722_2024",
        sourceType: "external_guidance_reference",
        versionLabel: "Version 9.2, 16-Apr-2024",
      }),
      expect.objectContaining({
        code: "UK_UAS_REGULATIONS",
        sourceType: "external_regulatory_reference",
      }),
    ]));
    expect(
      response.body.framework.pillars.map(
        (pillar: { code: string }) => pillar.code,
      ),
    ).toEqual([
      "SAFETY_POLICY_AND_GOALS",
      "SAFETY_RISK_MANAGEMENT",
      "SAFETY_ASSURANCE",
      "PROMOTION_OF_SAFETY",
    ]);
    expect(
      response.body.framework.pillars.flatMap(
        (pillar: { elements: unknown[] }) => pillar.elements,
      ),
    ).toHaveLength(12);
    expect(await countFrameworkRows()).toEqual(before);
  });

  it("groups the 12 SMS elements under the 4 SMS pillars", async () => {
    const response = await request(app).get("/sms/framework");

    expect(response.status).toBe(200);
    expect(response.body.framework.pillars).toEqual([
      expect.objectContaining({
        code: "SAFETY_POLICY_AND_GOALS",
        elements: [
          expect.objectContaining({
            code: "MANAGEMENT_COMMITMENT_AND_RESPONSIBILITY",
            elementNumber: "1.1",
          }),
          expect.objectContaining({
            code: "ULTIMATE_SAFETY_RESPONSIBILITY",
            elementNumber: "1.2",
          }),
          expect.objectContaining({
            code: "KEY_SAFETY_STAFF_IDENTIFICATION",
            elementNumber: "1.3",
          }),
          expect.objectContaining({
            code: "EMERGENCY_RESPONSE_PLANNING",
            elementNumber: "1.4",
          }),
          expect.objectContaining({
            code: "SMS_DOCUMENTATION",
            elementNumber: "1.5",
          }),
        ],
      }),
      expect.objectContaining({
        code: "SAFETY_RISK_MANAGEMENT",
        elements: [
          expect.objectContaining({
            code: "RISK_HAZARD_DETECTION_AND_IDENTIFICATION",
            elementNumber: "2.1",
          }),
          expect.objectContaining({
            code: "RISK_ASSESSMENT_AND_MITIGATION",
            elementNumber: "2.2",
          }),
        ],
      }),
      expect.objectContaining({
        code: "SAFETY_ASSURANCE",
        elements: [
          expect.objectContaining({
            code: "SAFETY_PERFORMANCE_MONITORING",
            elementNumber: "3.1",
          }),
          expect.objectContaining({
            code: "CHANGE_MANAGEMENT",
            elementNumber: "3.2",
          }),
          expect.objectContaining({
            code: "SMS_CONTINUOUS_IMPROVEMENT",
            elementNumber: "3.3",
          }),
        ],
      }),
      expect.objectContaining({
        code: "PROMOTION_OF_SAFETY",
        elements: [
          expect.objectContaining({
            code: "SAFETY_TRAINING_AND_EDUCATION",
            elementNumber: "4.1",
          }),
          expect.objectContaining({
            code: "SAFETY_COMMUNICATION",
            elementNumber: "4.2",
          }),
        ],
      }),
    ]);
  });

  it("keeps CAP722A as source context rather than executable compliance logic", async () => {
    const response = await request(app).get("/sms/framework");

    expect(response.status).toBe(200);
    expect(response.body.framework.sources).toContainEqual(
      expect.objectContaining({
        code: "CAA_CAP_722A_2022",
        sourceType: "external_guidance_reference",
        notes:
          "Recorded as source guidance and version context only; not executable compliance logic.",
      }),
    );
    expect(response.body.framework.pillars).not.toContainEqual(
      expect.objectContaining({
        sourceCode: "CAA_CAP_722A_2022",
      }),
    );
  });

  it("lists seeded FSMS control mappings with SMS pillar and element context", async () => {
    const before = await countFrameworkRows();

    const response = await request(app).get("/sms/control-mappings");

    expect(response.status).toBe(200);
    expect(
      response.body.mappings.map(
        (mapping: { code: string }) => mapping.code,
      ),
    ).toEqual([
      "PLATFORM_READINESS_MAINTENANCE",
      "PILOT_READINESS",
      "MISSION_RISK_ASSESSMENT",
      "AIRSPACE_COMPLIANCE",
      "MISSION_READINESS_GATE",
      "MISSION_APPROVAL_GUARD",
      "MISSION_DISPATCH_GUARD",
      "AUDIT_EVIDENCE_SNAPSHOTS",
      "POST_OPERATION_REPORT_SIGNOFF",
    ]);
    expect(response.body.mappings).toContainEqual(
      expect.objectContaining({
        code: "PLATFORM_READINESS_MAINTENANCE",
        controlArea: "platform",
        elements: expect.arrayContaining([
          expect.objectContaining({
            code: "RISK_ASSESSMENT_AND_MITIGATION",
            pillarCode: "SAFETY_RISK_MANAGEMENT",
            pillarTitle: "Safety Risk Management",
          }),
          expect.objectContaining({
            code: "SAFETY_PERFORMANCE_MONITORING",
            pillarCode: "SAFETY_ASSURANCE",
            pillarTitle: "Safety Assurance",
          }),
        ]),
      }),
    );
    expect(response.body.mappings).toContainEqual(
      expect.objectContaining({
        code: "POST_OPERATION_REPORT_SIGNOFF",
        controlArea: "audit",
        elements: expect.arrayContaining([
          expect.objectContaining({
            code: "ULTIMATE_SAFETY_RESPONSIBILITY",
            pillarCode: "SAFETY_POLICY_AND_GOALS",
          }),
          expect.objectContaining({
            code: "SMS_DOCUMENTATION",
            pillarCode: "SAFETY_POLICY_AND_GOALS",
          }),
          expect.objectContaining({
            code: "SMS_CONTINUOUS_IMPROVEMENT",
            pillarCode: "SAFETY_ASSURANCE",
          }),
        ]),
      }),
    );
    expect(await countFrameworkRows()).toEqual(before);
  });

  it("seeds control mappings for platform, pilot, risk, airspace, gate, and audit controls", async () => {
    const response = await request(app).get("/sms/control-mappings");

    expect(response.status).toBe(200);
    expect(response.body.mappings).toEqual([
      expect.objectContaining({ controlArea: "platform" }),
      expect.objectContaining({ controlArea: "pilot" }),
      expect.objectContaining({ controlArea: "risk" }),
      expect.objectContaining({ controlArea: "airspace" }),
      expect.objectContaining({ controlArea: "mission_gate" }),
      expect.objectContaining({ controlArea: "mission_gate" }),
      expect.objectContaining({ controlArea: "mission_gate" }),
      expect.objectContaining({ controlArea: "audit" }),
      expect.objectContaining({ controlArea: "audit" }),
    ]);
    expect(
      response.body.mappings.every(
        (mapping: { elements: unknown[] }) => mapping.elements.length > 0,
      ),
    ).toBe(true);
  });

  it("rejects broken SMS control mapping element links", async () => {
    const before = await countFrameworkRows();

    await expect(
      pool.query(
        `
        insert into sms_control_element_mappings (
          control_code,
          element_code,
          rationale,
          display_order
        )
        values ($1, $2, $3, $4)
        `,
        [
          "PLATFORM_READINESS_MAINTENANCE",
          "UNKNOWN_SMS_ELEMENT",
          "This should fail because the SMS element does not exist.",
          99,
        ],
      ),
    ).rejects.toMatchObject({
      code: "23503",
    });
    expect(await countFrameworkRows()).toEqual(before);
  });

  it("lists regulatory requirement mappings to platform controls without making compliance claims", async () => {
    const before = await countFrameworkRows();

    const response = await request(app).get(
      "/sms/regulatory-requirement-mappings",
    );

    expect(response.status).toBe(200);
    expect(response.body.mappings).toEqual([
      expect.objectContaining({
        requirementCode: "REG_UAS_OPERATING_SOURCE_BASIS",
        sourceCode: "CAA_CAP_722_2024",
        controlCode: "MISSION_RISK_ASSESSMENT",
        assuranceOwner: "compliance_owner",
        reviewStatus: "needs_clause_review",
      }),
      expect.objectContaining({
        requirementCode: "REG_AIRSPACE_PERMISSION_EVIDENCE",
        sourceCode: "CAA_CAP_722_2024",
        controlCode: "AIRSPACE_COMPLIANCE",
        evidenceType: "airspace compliance input and evidence reference",
      }),
      expect.objectContaining({
        requirementCode: "REG_OPERATING_SAFETY_CASE_CONTEXT",
        sourceCode: "CAA_CAP_722A_2022",
        controlCode: "AUDIT_EVIDENCE_SNAPSHOTS",
      }),
      expect.objectContaining({
        requirementCode: "REG_CHANGE_MANAGEMENT_AMENDMENTS",
        sourceCode: "UK_UAS_REGULATIONS",
        controlCode: "MISSION_READINESS_GATE",
        reviewStatus: "source_mapped",
      }),
      expect.objectContaining({
        requirementCode: "REG_POST_OPERATION_RECORDS",
        sourceCode: "CAA_CAP_722_2024",
        controlCode: "POST_OPERATION_REPORT_SIGNOFF",
      }),
    ]);
    expect(
      response.body.mappings.every(
        (mapping: { reviewStatus: string }) =>
          mapping.reviewStatus !== "accepted",
      ),
    ).toBe(true);
    expect(await countFrameworkRows()).toEqual(before);
  });

  it("rejects regulatory mappings to unknown platform controls", async () => {
    const before = await countFrameworkRows();

    await expect(
      pool.query(
        `
        insert into regulatory_requirement_mappings (
          requirement_code,
          source_code,
          requirement_ref,
          requirement_summary,
          compliance_intent,
          control_code,
          evidence_type,
          assurance_owner,
          review_status,
          display_order
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          "REG_BROKEN_CONTROL_LINK",
          "CAA_CAP_722_2024",
          "Broken test ref",
          "This should fail because the platform control does not exist.",
          "Prevent untraceable compliance mappings.",
          "UNKNOWN_CONTROL",
          "test evidence",
          "compliance_owner",
          "source_mapped",
          99,
        ],
      ),
    ).rejects.toMatchObject({
      code: "23503",
    });
    expect(await countFrameworkRows()).toEqual(before);
  });
});
