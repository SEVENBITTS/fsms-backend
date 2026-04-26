import type {
  InsuranceDocument,
  InsuranceProfile,
} from "../insurance/insurance.types";
import type {
  OperationalAuthorityDocument,
  OperationalAuthorityPilotAuthorisation,
  OperationalAuthorityProfile,
} from "../operational-authority/operational-authority.types";
import type {
  RiskMapResult,
  RiskMapThreatLevel,
} from "../risk-map/risk-map.types";

export interface AccountableManagerMissionSummary {
  missionId: string;
  missionPlanId: string | null;
  status: string;
  operationType: string | null;
  requiresBvlos: boolean;
  platformName: string | null;
  pilotName: string | null;
  updatedAt: string;
}

export interface AccountableManagerStageSummary {
  stage:
    | "operational_authority"
    | "insurance"
    | "competency"
    | "maintenance"
    | "override"
    | "personnel";
  label: string;
  result: RiskMapResult;
  threatLevel: RiskMapThreatLevel;
  affectedMissionCount: number;
  headline: string;
}

export interface AccountableManagerAlert {
  code:
    | "OA_ACTIVE_PROFILE_MISSING"
    | "OA_RENEWAL_SOON"
    | "OA_EXPIRED"
    | "INSURANCE_ACTIVE_PROFILE_MISSING"
    | "INSURANCE_RENEWAL_SOON"
    | "INSURANCE_EXPIRED"
    | "OA_PERSONNEL_PENDING_AMENDMENT"
    | "OA_PERSONNEL_RESTRICTED";
  result: RiskMapResult;
  threatLevel: RiskMapThreatLevel;
  title: string;
  summary: string;
  targetPath: string;
}

export interface AccountableManagerMissionHotspot {
  missionId: string;
  missionPlanId: string | null;
  status: string;
  result: RiskMapResult;
  threatLevel: RiskMapThreatLevel;
  score: number;
  headline: string;
  reasons: string[];
  recommendedActions: string[];
  targetPath: string;
}

export interface AccountableManagerDashboard {
  organisationId: string;
  viewerRole: string;
  generatedAt: string;
  overall: {
    result: RiskMapResult;
    threatLevel: RiskMapThreatLevel;
    headline: string;
  };
  summary: {
    totalMissions: number;
    immediateAttentionMissions: number;
    reviewMissions: number;
    healthyMissions: number;
    oaRenewalPressureCount: number;
    insuranceRenewalPressureCount: number;
    pilotPendingAmendmentCount: number;
    restrictedPilotCount: number;
    maintenancePressureCount: number;
    overridePressureCount: number;
  };
  stageMap: AccountableManagerStageSummary[];
  alerts: AccountableManagerAlert[];
  currentRecords: {
    operationalAuthority: {
      profile: OperationalAuthorityProfile | null;
      document: OperationalAuthorityDocument | null;
    };
    insurance: {
      profile: InsuranceProfile | null;
      document: InsuranceDocument | null;
    };
  };
  personnel: {
    activeProfileId: string | null;
    pendingAmendmentCount: number;
    restrictedPilotCount: number;
    inactivePilotCount: number;
    latestAuthorisations: OperationalAuthorityPilotAuthorisation[];
  };
  missionHotspots: AccountableManagerMissionHotspot[];
  missions: AccountableManagerMissionSummary[];
}
