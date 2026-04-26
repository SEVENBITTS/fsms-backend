import { InsuranceService } from "../insurance/insurance.service";
import { MissionAccessService } from "../mission-access/mission-access.service";
import { OperationalAuthorityService } from "../operational-authority/operational-authority.service";
import { PilotService } from "../pilots/pilot.service";
import type {
  MissionGovernanceAssessment,
  MissionGovernanceAssessmentResult,
  MissionGovernanceReason,
} from "./mission-governance.types";

export class MissionGovernanceService {
  constructor(
    private readonly operationalAuthorityService: OperationalAuthorityService,
    private readonly insuranceService: InsuranceService,
    private readonly pilotService: PilotService,
    private readonly missionAccessService: MissionAccessService,
  ) {}

  async assessMissionGovernance(
    missionId: string,
  ): Promise<MissionGovernanceAssessment> {
    const operationalAuthority =
      await this.operationalAuthorityService.assessMissionOperationalAuthority(
        missionId,
      );
    const insurance = await this.insuranceService.assessMissionInsurance(missionId);
    const missionContext = await this.missionAccessService.getMissionContext(missionId);
    const pilotReadiness = missionContext.pilotId
      ? await this.pilotService.checkPilotReadiness(missionContext.pilotId)
      : null;

    const reasons: MissionGovernanceReason[] = [
      ...operationalAuthority.reasons.map((reason) => ({
        domain: "operational_authority" as const,
        code: reason.code,
        severity: reason.severity,
        message: reason.message,
        clauseReference: reason.clauseReference,
      })),
      ...insurance.reasons.map((reason) => ({
        domain: "insurance" as const,
        code: reason.code,
        severity: reason.severity,
        message: reason.message,
        clauseReference: reason.clauseReference,
      })),
      ...(pilotReadiness?.reasons.map((reason) => ({
        domain: "pilot_readiness" as const,
        code: reason.code,
        severity: reason.severity,
        message: reason.message,
      })) ?? []),
    ];

    const result = this.resolveOverallResult(
      reasons.map((reason) => reason.severity),
    );

    return {
      missionId,
      organisationId:
        operationalAuthority.organisationId ?? insurance.organisationId ?? null,
      result,
      summary: {
        failCount: reasons.filter((reason) => reason.severity === "fail").length,
        warningCount: reasons.filter((reason) => reason.severity === "warning")
          .length,
        passCount: reasons.filter((reason) => reason.severity === "pass").length,
      },
      reasons,
      operationalAuthority,
      insurance,
      pilotReadiness,
    };
  }

  private resolveOverallResult(
    severities: MissionGovernanceAssessmentResult[],
  ): MissionGovernanceAssessmentResult {
    if (severities.some((severity) => severity === "fail")) {
      return "fail";
    }

    if (severities.some((severity) => severity === "warning")) {
      return "warning";
    }

    return "pass";
  }
}
