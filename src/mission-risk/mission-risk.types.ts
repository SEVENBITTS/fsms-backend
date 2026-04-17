export type OperatingCategory = "open" | "specific" | "certified";

export type RiskLevel = "low" | "medium" | "high";

export interface CreateMissionRiskInput {
  operatingCategory?: OperatingCategory;
  missionComplexity?: RiskLevel;
  populationExposure?: RiskLevel;
  airspaceComplexity?: RiskLevel;
  weatherRisk?: RiskLevel;
  payloadRisk?: RiskLevel;
  mitigationSummary?: string | null;
}

export interface MissionRiskInput {
  id: string;
  missionId: string;
  operatingCategory: OperatingCategory;
  missionComplexity: RiskLevel;
  populationExposure: RiskLevel;
  airspaceComplexity: RiskLevel;
  weatherRisk: RiskLevel;
  payloadRisk: RiskLevel;
  mitigationSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MissionRiskResult = "pass" | "warning" | "fail";

export type MissionRiskBand = "low" | "moderate" | "high";

export type MissionRiskReasonCode =
  | "MISSION_RISK_ACCEPTABLE"
  | "MISSION_RISK_ELEVATED"
  | "MISSION_RISK_HIGH"
  | "MISSION_RISK_MISSING";

export interface MissionRiskReason {
  code: MissionRiskReasonCode;
  severity: MissionRiskResult;
  message: string;
}

export interface MissionRiskAssessment {
  missionId: string;
  result: MissionRiskResult;
  score: number | null;
  riskBand: MissionRiskBand | null;
  reasons: MissionRiskReason[];
  input: MissionRiskInput | null;
}
