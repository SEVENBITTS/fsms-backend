import { computeSummary, ValidationReport } from "./computeSummary"

describe("computeSummary", () => {
  it("computes counts and average lead time using only eligible PASS breach scenarios", () => {
    const report: ValidationReport = {
      metadata: {
        generated_at: "2026-03-28T10:30:00Z",
      },
      scenarios: [
        {
          scenario_id: "s1",
          scenario_name: "Eligible PASS breach 1",
          classification: "PASS",
          lead_seconds: 10,
          has_truth_breach_event: true,
          is_baseline: false,
          is_borderline_ceiling: false,
        },
        {
          scenario_id: "s2",
          scenario_name: "Eligible PASS breach 2",
          classification: "PASS",
          lead_seconds: 20,
          has_truth_breach_event: true,
          is_baseline: false,
          is_borderline_ceiling: false,
        },
        {
          scenario_id: "s3",
          scenario_name: "PASS baseline excluded",
          classification: "PASS",
          lead_seconds: 99,
          has_truth_breach_event: true,
          is_baseline: true,
          is_borderline_ceiling: false,
        },
        {
          scenario_id: "s4",
          scenario_name: "PASS borderline excluded",
          classification: "PASS",
          lead_seconds: 50,
          has_truth_breach_event: true,
          is_baseline: false,
          is_borderline_ceiling: true,
        },
        {
          scenario_id: "s5",
          scenario_name: "PASS non-breach excluded",
          classification: "PASS",
          lead_seconds: 30,
          has_truth_breach_event: false,
          is_baseline: false,
          is_borderline_ceiling: false,
        },
        {
          scenario_id: "s6",
          scenario_name: "PASS null lead excluded",
          classification: "PASS",
          lead_seconds: null,
          has_truth_breach_event: true,
          is_baseline: false,
          is_borderline_ceiling: false,
        },
        {
          scenario_id: "s7",
          scenario_name: "REVIEW row",
          classification: "REVIEW",
          lead_seconds: 15,
          has_truth_breach_event: true,
          is_baseline: false,
          is_borderline_ceiling: false,
        },
        {
          scenario_id: "s8",
          scenario_name: "FAIL row",
          classification: "FAIL",
          lead_seconds: 12,
          has_truth_breach_event: true,
          is_baseline: false,
          is_borderline_ceiling: false,
        },
      ],
    }

    const summary = computeSummary(report)

    expect(summary.totalScenarios).toBe(8)
    expect(summary.passCount).toBe(6)
    expect(summary.reviewCount).toBe(1)
    expect(summary.failCount).toBe(1)
    expect(summary.breachScenariosCovered).toBe(7)
    expect(summary.latestRunTimestamp).toBe("2026-03-28T10:30:00Z")
    expect(summary.avgPassLeadSeconds).toBe(15)
  })

  it("returns null average lead time when no eligible PASS breach scenarios exist", () => {
    const report: ValidationReport = {
      metadata: {
        generated_at: "2026-03-28T10:30:00Z",
      },
      scenarios: [
        {
          scenario_id: "s1",
          scenario_name: "REVIEW breach",
          classification: "REVIEW",
          lead_seconds: 10,
          has_truth_breach_event: true,
          is_baseline: false,
          is_borderline_ceiling: false,
        },
        {
          scenario_id: "s2",
          scenario_name: "PASS but no breach",
          classification: "PASS",
          lead_seconds: 20,
          has_truth_breach_event: false,
          is_baseline: false,
          is_borderline_ceiling: false,
        },
        {
          scenario_id: "s3",
          scenario_name: "PASS breach but null lead",
          classification: "PASS",
          lead_seconds: null,
          has_truth_breach_event: true,
          is_baseline: false,
          is_borderline_ceiling: false,
        },
      ],
    }

    const summary = computeSummary(report)

    expect(summary.totalScenarios).toBe(3)
    expect(summary.passCount).toBe(2)
    expect(summary.reviewCount).toBe(1)
    expect(summary.failCount).toBe(0)
    expect(summary.breachScenariosCovered).toBe(2)
    expect(summary.avgPassLeadSeconds).toBeNull()
  })

  it("handles an empty report", () => {
    const report: ValidationReport = {
      metadata: {},
      scenarios: [],
    }

    const summary = computeSummary(report)

    expect(summary.totalScenarios).toBe(0)
    expect(summary.passCount).toBe(0)
    expect(summary.reviewCount).toBe(0)
    expect(summary.failCount).toBe(0)
    expect(summary.breachScenariosCovered).toBe(0)
    expect(summary.latestRunTimestamp).toBeNull()
    expect(summary.avgPassLeadSeconds).toBeNull()
  })
})