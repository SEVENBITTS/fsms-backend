import type { PilotReadinessCheck } from "../pilots/pilot.types";
import type { PlatformReadinessCheck } from "../platforms/platform.types";
import type { MissionGovernanceAssessment } from "../mission-governance/mission-governance.types";

export type RiskMapResult = "pass" | "warning" | "fail";
export type RiskMapThreatLevel = "stable" | "emerging" | "immediate";

export type RiskMapCategoryCode =
  | "oa_renewal"
  | "insurance_renewal"
  | "pilot_competency"
  | "platform_maintenance"
  | "override_pressure";

export interface RiskMapCategory {
  code: RiskMapCategoryCode;
  label: string;
  result: RiskMapResult;
  threatLevel: RiskMapThreatLevel;
  headline: string;
  signals: string[];
  recommendedActions: string[];
}

export interface MissionOverridePressureSummary {
  overrideEventCount: number;
  latestOverrideAt: string | null;
  reviewRequiredSnapshotCount: number;
  latestSnapshotRequiresReview: boolean;
}

export interface MissionRiskMap {
  missionId: string;
  organisationId: string | null;
  overall: {
    result: RiskMapResult;
    threatLevel: RiskMapThreatLevel;
    score: number;
  };
  stageMap: Array<{
    stage:
      | "governance"
      | "insurance"
      | "competency"
      | "maintenance"
      | "override";
    result: RiskMapResult;
    threatLevel: RiskMapThreatLevel;
  }>;
  categories: RiskMapCategory[];
  governance: MissionGovernanceAssessment;
  pilotCompetency: PilotReadinessCheck | null;
  platformMaintenance: PlatformReadinessCheck | null;
  overridePressure: MissionOverridePressureSummary;
}
