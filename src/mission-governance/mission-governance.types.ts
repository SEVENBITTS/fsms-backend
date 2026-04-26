import type {
  OperationalAuthorityAssessment,
  OperationalAuthorityAssessmentReasonCode,
} from "../operational-authority/operational-authority.types";
import type {
  InsuranceAssessment,
  InsuranceAssessmentReasonCode,
} from "../insurance/insurance.types";
import type {
  PilotReadinessCheck,
  PilotReadinessReasonCode,
} from "../pilots/pilot.types";

export type MissionGovernanceAssessmentResult = "pass" | "warning" | "fail";

export interface MissionGovernanceReason {
  domain: "operational_authority" | "insurance" | "pilot_readiness";
  code:
    | OperationalAuthorityAssessmentReasonCode
    | InsuranceAssessmentReasonCode
    | PilotReadinessReasonCode;
  severity: MissionGovernanceAssessmentResult;
  message: string;
  clauseReference?: string | null;
}

export interface MissionGovernanceAssessment {
  missionId: string;
  organisationId: string | null;
  result: MissionGovernanceAssessmentResult;
  summary: {
    failCount: number;
    warningCount: number;
    passCount: number;
  };
  reasons: MissionGovernanceReason[];
  operationalAuthority: OperationalAuthorityAssessment;
  insurance: InsuranceAssessment;
  pilotReadiness: PilotReadinessCheck | null;
}
