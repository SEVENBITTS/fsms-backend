export type Classification = "PASS" | "REVIEW" | "FAIL"

export type ScenarioRow = {
  scenario_id: string
  scenario_name: string
  classification: Classification | string
  lead_seconds?: number | null
  has_truth_breach_event?: boolean
  is_baseline?: boolean
  is_borderline_ceiling?: boolean
}

export type ValidationReport = {
  metadata?: {
    generated_at?: string | null
    flight_id?: string | null
    report_version?: string | null
  }
  scenarios: ScenarioRow[]
}

export type SummaryMetrics = {
  totalScenarios: number
  passCount: number
  reviewCount: number
  failCount: number
  latestRunTimestamp: string | null
  avgPassLeadSeconds: number | null
  breachScenariosCovered: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function computeSummary(report: ValidationReport): SummaryMetrics {
  const rows = Array.isArray(report.scenarios) ? report.scenarios : []

  let passCount = 0
  let reviewCount = 0
  let failCount = 0
  let breachScenariosCovered = 0

  let passingLeadSum = 0
  let passingLeadCount = 0

  for (const row of rows) {
    if (row.classification === "PASS") passCount += 1
    else if (row.classification === "REVIEW") reviewCount += 1
    else if (row.classification === "FAIL") failCount += 1

    const hasTruthBreachEvent = row.has_truth_breach_event === true
    if (hasTruthBreachEvent) {
      breachScenariosCovered += 1
    }

    const lead = row.lead_seconds

    const eligibleForAvgLeadTime =
      hasTruthBreachEvent &&
      row.classification === "PASS" &&
      row.is_baseline !== true &&
      row.is_borderline_ceiling !== true &&
      isFiniteNumber(lead)

    if (eligibleForAvgLeadTime) {
      passingLeadSum += lead
      passingLeadCount += 1
    }
  }

  return {
    totalScenarios: rows.length,
    passCount,
    reviewCount,
    failCount,
    latestRunTimestamp: report.metadata?.generated_at ?? null,
    avgPassLeadSeconds:
      passingLeadCount > 0 ? passingLeadSum / passingLeadCount : null,
    breachScenariosCovered,
  }
}