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
      (select count(*)::int from sms_control_element_mappings) as mapping_count
    `,
  );

  return result.rows[0] as {
    source_count: number;
    pillar_count: number;
    element_count: number;
    control_count: number;
    mapping_count: number;
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
    expect(response.body.framework.sources).toEqual([
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
    ]);
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
});
