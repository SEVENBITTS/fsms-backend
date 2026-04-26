import type { Pool } from "pg";
import type {
  InsuranceDocument,
  InsuranceProfile,
} from "../insurance/insurance.types";
import { InsuranceRepository } from "../insurance/insurance.repository";
import type {
  OperationalAuthorityDocument,
  OperationalAuthorityPilotAuthorisation,
  OperationalAuthorityProfile,
} from "../operational-authority/operational-authority.types";
import { OperationalAuthorityRepository } from "../operational-authority/operational-authority.repository";
import { RiskMapService } from "../risk-map/risk-map.service";
import type {
  MissionRiskMap,
  RiskMapCategory,
  RiskMapResult,
  RiskMapThreatLevel,
} from "../risk-map/risk-map.types";
import { AccountableManagerDashboardRepository } from "./accountable-manager-dashboard.repository";
import type {
  AccountableManagerAlert,
  AccountableManagerDashboard,
  AccountableManagerMissionHotspot,
  AccountableManagerMissionSummary,
  AccountableManagerStageSummary,
} from "./accountable-manager-dashboard.types";

const RENEWAL_SOON_DAYS = 30;
const DEFAULT_MISSION_LIMIT = 12;

export class AccountableManagerDashboardService {
  constructor(
    private readonly pool: Pool,
    private readonly dashboardRepository: AccountableManagerDashboardRepository,
    private readonly riskMapService: RiskMapService,
    private readonly operationalAuthorityRepository: OperationalAuthorityRepository,
    private readonly insuranceRepository: InsuranceRepository,
  ) {}

  async getDashboard(
    organisationId: string,
    viewerRole: string,
  ): Promise<AccountableManagerDashboard> {
    const client = await this.pool.connect();

    try {
      const missions = await this.dashboardRepository.listMissionSummariesByOrganisation(
        client,
        organisationId,
        DEFAULT_MISSION_LIMIT,
      );

      const oaProfile =
        await this.operationalAuthorityRepository.getLatestActiveProfileForOrganisation(
          client,
          organisationId,
        );
      const insuranceProfile =
        await this.insuranceRepository.getLatestActiveProfileForOrganisation(
          client,
          organisationId,
        );
      const oaDocuments =
        await this.operationalAuthorityRepository.listDocumentsByOrganisation(
          client,
          organisationId,
        );
      const insuranceDocuments =
        await this.insuranceRepository.listDocumentsByOrganisation(
          client,
          organisationId,
        );
      const pilotAuthorisations = oaProfile
        ? await this.operationalAuthorityRepository.listPilotAuthorisationsForProfile(
            client,
            oaProfile.id,
          )
        : [];
      const riskMaps = await Promise.all(
        missions.map((mission) =>
          this.riskMapService.getMissionRiskMap(mission.missionId),
        ),
      );

      const currentOperationalAuthorityDocument = this.findCurrentOperationalAuthorityDocument(
        oaDocuments,
        oaProfile,
      );
      const currentInsuranceDocument = this.findCurrentInsuranceDocument(
        insuranceDocuments,
        insuranceProfile,
      );

      const alerts = [
        ...this.buildOperationalAuthorityAlerts(
          organisationId,
          oaProfile,
          currentOperationalAuthorityDocument,
        ),
        ...this.buildInsuranceAlerts(
          organisationId,
          insuranceProfile,
          currentInsuranceDocument,
        ),
        ...this.buildPersonnelAlerts(organisationId, pilotAuthorisations),
      ];

      const stageMap = this.buildStageMap(riskMaps, pilotAuthorisations);
      const missionHotspots = this.buildMissionHotspots(missions, riskMaps);

      const overallResult = this.resolveOverallResult([
        ...stageMap.map((stage) => stage.result),
        ...alerts.map((alert) => alert.result),
      ]);
      const overallThreatLevel = this.toThreatLevel(overallResult);

      const immediateAttentionMissions = riskMaps.filter(
        (riskMap) => riskMap.overall.result === "fail",
      ).length;
      const reviewMissions = riskMaps.filter(
        (riskMap) => riskMap.overall.result === "warning",
      ).length;
      const healthyMissions = riskMaps.filter(
        (riskMap) => riskMap.overall.result === "pass",
      ).length;

      return {
        organisationId,
        viewerRole,
        generatedAt: new Date().toISOString(),
        overall: {
          result: overallResult,
          threatLevel: overallThreatLevel,
          headline: this.buildOverallHeadline({
            missionCount: missions.length,
            immediateAttentionMissions,
            reviewMissions,
            alertCount: alerts.length,
            overallResult,
          }),
        },
        summary: {
          totalMissions: missions.length,
          immediateAttentionMissions,
          reviewMissions,
          healthyMissions,
          oaRenewalPressureCount: riskMaps.filter((riskMap) =>
            this.hasCategoryResult(riskMap, "oa_renewal", ["warning", "fail"]),
          ).length,
          insuranceRenewalPressureCount: riskMaps.filter((riskMap) =>
            this.hasCategoryResult(riskMap, "insurance_renewal", ["warning", "fail"]),
          ).length,
          pilotPendingAmendmentCount: pilotAuthorisations.filter(
            (authorisation) =>
              authorisation.authorisationState === "pending_amendment",
          ).length,
          restrictedPilotCount: pilotAuthorisations.filter((authorisation) =>
            ["restricted", "inactive"].includes(authorisation.authorisationState),
          ).length,
          maintenancePressureCount: riskMaps.filter((riskMap) =>
            this.hasCategoryResult(riskMap, "platform_maintenance", [
              "warning",
              "fail",
            ]),
          ).length,
          overridePressureCount: riskMaps.filter((riskMap) =>
            this.hasCategoryResult(riskMap, "override_pressure", [
              "warning",
              "fail",
            ]),
          ).length,
        },
        stageMap,
        alerts,
        currentRecords: {
          operationalAuthority: {
            profile: oaProfile,
            document: currentOperationalAuthorityDocument,
          },
          insurance: {
            profile: insuranceProfile,
            document: currentInsuranceDocument,
          },
        },
        personnel: {
          activeProfileId: oaProfile?.id ?? null,
          pendingAmendmentCount: pilotAuthorisations.filter(
            (authorisation) =>
              authorisation.authorisationState === "pending_amendment",
          ).length,
          restrictedPilotCount: pilotAuthorisations.filter(
            (authorisation) => authorisation.authorisationState === "restricted",
          ).length,
          inactivePilotCount: pilotAuthorisations.filter(
            (authorisation) => authorisation.authorisationState === "inactive",
          ).length,
          latestAuthorisations: pilotAuthorisations.slice(0, 10),
        },
        missionHotspots,
        missions,
      };
    } finally {
      client.release();
    }
  }

  private buildStageMap(
    riskMaps: MissionRiskMap[],
    pilotAuthorisations: OperationalAuthorityPilotAuthorisation[],
  ): AccountableManagerStageSummary[] {
    return [
      this.buildStageSummary(
        "operational_authority",
        "Operational Authority",
        riskMaps,
        "oa_renewal",
        "OA governance is currently stable.",
        "OA governance is drifting toward renewal or review pressure.",
        "OA governance has immediate pressure requiring accountable attention.",
      ),
      this.buildStageSummary(
        "insurance",
        "Insurance",
        riskMaps,
        "insurance_renewal",
        "Insurance cover is currently stable.",
        "Insurance cover is drifting toward renewal or review pressure.",
        "Insurance cover has immediate pressure requiring accountable attention.",
      ),
      this.buildStageSummary(
        "competency",
        "Pilot Competency",
        riskMaps,
        "pilot_competency",
        "Pilot competency is currently stable.",
        "Pilot competency requires closer review.",
        "Pilot competency has immediate pressure requiring accountable attention.",
      ),
      this.buildStageSummary(
        "maintenance",
        "Platform Maintenance",
        riskMaps,
        "platform_maintenance",
        "Platform maintenance is currently stable.",
        "Platform maintenance is becoming an operational pressure point.",
        "Platform maintenance has immediate pressure requiring accountable attention.",
      ),
      this.buildStageSummary(
        "override",
        "Override Pressure",
        riskMaps,
        "override_pressure",
        "Override pressure is currently low.",
        "Override pressure is emerging and should be reviewed.",
        "Override pressure is high and should be investigated immediately.",
      ),
      this.buildPersonnelStageSummary(pilotAuthorisations),
    ];
  }

  private buildStageSummary(
    stage: AccountableManagerStageSummary["stage"],
    label: string,
    riskMaps: MissionRiskMap[],
    categoryCode: RiskMapCategory["code"],
    passHeadline: string,
    warningHeadline: string,
    failHeadline: string,
  ): AccountableManagerStageSummary {
    const matched = riskMaps
      .map((riskMap) => riskMap.categories.find((category) => category.code === categoryCode))
      .filter((category): category is RiskMapCategory => Boolean(category));

    const affectedMissionCount = matched.filter(
      (category) => category.result !== "pass",
    ).length;
    const result = this.resolveOverallResult(matched.map((category) => category.result));

    return {
      stage,
      label,
      result,
      threatLevel: this.toThreatLevel(result),
      affectedMissionCount,
      headline:
        result === "fail"
          ? failHeadline
          : result === "warning"
            ? warningHeadline
            : passHeadline,
    };
  }

  private buildPersonnelStageSummary(
    pilotAuthorisations: OperationalAuthorityPilotAuthorisation[],
  ): AccountableManagerStageSummary {
    const pendingCount = pilotAuthorisations.filter(
      (authorisation) =>
        authorisation.authorisationState === "pending_amendment",
    ).length;
    const restrictedCount = pilotAuthorisations.filter((authorisation) =>
      ["restricted", "inactive"].includes(authorisation.authorisationState),
    ).length;

    const result: RiskMapResult =
      restrictedCount > 0 ? "fail" : pendingCount > 0 ? "warning" : "pass";

    return {
      stage: "personnel",
      label: "OA Personnel",
      result,
      threatLevel: this.toThreatLevel(result),
      affectedMissionCount: pendingCount + restrictedCount,
      headline:
        result === "fail"
          ? "One or more OA personnel records are restricted or inactive."
          : result === "warning"
            ? "OA personnel amendments are pending and should be tracked closely."
            : "OA personnel status is currently stable.",
    };
  }

  private buildOperationalAuthorityAlerts(
    organisationId: string,
    profile: OperationalAuthorityProfile | null,
    document: OperationalAuthorityDocument | null,
  ): AccountableManagerAlert[] {
    if (!profile || !document) {
      return [
        {
          code: "OA_ACTIVE_PROFILE_MISSING",
          result: "fail",
          threatLevel: "immediate",
          title: "No active OA profile is currently recorded.",
          summary:
            "Accountable review is required because the organisation does not currently have an active OA profile recorded in VerityATLAS.",
          targetPath: `/operator/organisations/${encodeURIComponent(organisationId)}/document-portal`,
        },
      ];
    }

    return this.buildDocumentValidityAlerts({
      organisationId,
      kind: "oa",
      effectiveFrom: document.effectiveFrom,
      expiresAt: document.expiresAt,
    });
  }

  private buildInsuranceAlerts(
    organisationId: string,
    profile: InsuranceProfile | null,
    document: InsuranceDocument | null,
  ): AccountableManagerAlert[] {
    if (!profile || !document) {
      return [
        {
          code: "INSURANCE_ACTIVE_PROFILE_MISSING",
          result: "fail",
          threatLevel: "immediate",
          title: "No active insurance profile is currently recorded.",
          summary:
            "Accountable review is required because the organisation does not currently have an active insurance profile recorded in VerityATLAS.",
          targetPath: `/operator/organisations/${encodeURIComponent(organisationId)}/document-portal`,
        },
      ];
    }

    return this.buildDocumentValidityAlerts({
      organisationId,
      kind: "insurance",
      effectiveFrom: document.effectiveFrom,
      expiresAt: document.expiresAt,
    });
  }

  private buildDocumentValidityAlerts(params: {
    organisationId: string;
    kind: "oa" | "insurance";
    effectiveFrom: string;
    expiresAt: string;
  }): AccountableManagerAlert[] {
    const alerts: AccountableManagerAlert[] = [];
    const now = Date.now();
    const effectiveFrom = new Date(params.effectiveFrom).getTime();
    const expiresAt = new Date(params.expiresAt).getTime();
    const renewalSoonMs = RENEWAL_SOON_DAYS * 24 * 60 * 60 * 1000;

    if (Number.isFinite(expiresAt) && expiresAt < now) {
      alerts.push({
        code: params.kind === "oa" ? "OA_EXPIRED" : "INSURANCE_EXPIRED",
        result: "fail",
        threatLevel: "immediate",
        title:
          params.kind === "oa"
            ? "Recorded OA evidence has expired."
            : "Recorded insurance evidence has expired.",
        summary:
          params.kind === "oa"
            ? "The current OA record appears to be beyond its validity window and should be reviewed immediately."
            : "The current insurance record appears to be beyond its validity window and should be reviewed immediately.",
        targetPath: `/operator/organisations/${encodeURIComponent(params.organisationId)}/document-portal`,
      });
    } else if (
      Number.isFinite(expiresAt) &&
      expiresAt > now &&
      expiresAt - now <= renewalSoonMs
    ) {
      alerts.push({
        code:
          params.kind === "oa"
            ? "OA_RENEWAL_SOON"
            : "INSURANCE_RENEWAL_SOON",
        result: "warning",
        threatLevel: "emerging",
        title:
          params.kind === "oa"
            ? "OA renewal window is approaching."
            : "Insurance renewal window is approaching.",
        summary:
          params.kind === "oa"
            ? "The active OA evidence will soon require renewal or variation follow-up."
            : "The active insurance evidence will soon require renewal or variation follow-up.",
        targetPath: `/operator/organisations/${encodeURIComponent(params.organisationId)}/document-portal`,
      });
    }

    if (Number.isFinite(effectiveFrom) && effectiveFrom > now) {
      alerts.push({
        code:
          params.kind === "oa"
            ? "OA_RENEWAL_SOON"
            : "INSURANCE_RENEWAL_SOON",
        result: "warning",
        threatLevel: "emerging",
        title:
          params.kind === "oa"
            ? "OA record is not yet effective."
            : "Insurance record is not yet effective.",
        summary:
          params.kind === "oa"
            ? "The recorded OA document has an effective date in the future and should be checked before reliance."
            : "The recorded insurance document has an effective date in the future and should be checked before reliance.",
        targetPath: `/operator/organisations/${encodeURIComponent(params.organisationId)}/document-portal`,
      });
    }

    return alerts;
  }

  private buildPersonnelAlerts(
    organisationId: string,
    pilotAuthorisations: OperationalAuthorityPilotAuthorisation[],
  ): AccountableManagerAlert[] {
    const alerts: AccountableManagerAlert[] = [];
    const pendingCount = pilotAuthorisations.filter(
      (authorisation) =>
        authorisation.authorisationState === "pending_amendment",
    ).length;
    const restrictedCount = pilotAuthorisations.filter((authorisation) =>
      ["restricted", "inactive"].includes(authorisation.authorisationState),
    ).length;

    if (pendingCount > 0) {
      alerts.push({
        code: "OA_PERSONNEL_PENDING_AMENDMENT",
        result: "warning",
        threatLevel: "emerging",
        title: "OA personnel amendments are pending.",
        summary: `${pendingCount} pilot authorisation record(s) are pending OA amendment and should be tracked before mission reliance grows.`,
        targetPath: `/operator/organisations/${encodeURIComponent(organisationId)}/document-portal`,
      });
    }

    if (restrictedCount > 0) {
      alerts.push({
        code: "OA_PERSONNEL_RESTRICTED",
        result: "fail",
        threatLevel: "immediate",
        title: "Restricted or inactive OA personnel records are present.",
        summary: `${restrictedCount} pilot authorisation record(s) are restricted or inactive and should be reviewed before continued assignment.`,
        targetPath: `/operator/organisations/${encodeURIComponent(organisationId)}/document-portal`,
      });
    }

    return alerts;
  }

  private buildMissionHotspots(
    missions: AccountableManagerMissionSummary[],
    riskMaps: MissionRiskMap[],
  ): AccountableManagerMissionHotspot[] {
    const missionById = new Map(missions.map((mission) => [mission.missionId, mission]));

    return riskMaps
      .map((riskMap) => {
        const mission = missionById.get(riskMap.missionId);
        const topCategory = [...riskMap.categories].sort(
          (left, right) =>
            this.resultWeight(right.result) - this.resultWeight(left.result),
        )[0];

        return {
          missionId: riskMap.missionId,
          missionPlanId: mission?.missionPlanId ?? null,
          status: mission?.status ?? "unknown",
          result: riskMap.overall.result,
          threatLevel: riskMap.overall.threatLevel,
          score: riskMap.overall.score,
          headline:
            topCategory?.headline ??
            "Mission governance requires accountable review.",
          reasons: topCategory?.signals.slice(0, 3) ?? [],
          recommendedActions:
            topCategory?.recommendedActions.slice(0, 2) ?? [],
          targetPath: `/operator/missions/${encodeURIComponent(riskMap.missionId)}`,
        };
      })
      .sort((left, right) => {
        const resultDelta =
          this.resultWeight(right.result) - this.resultWeight(left.result);
        if (resultDelta !== 0) {
          return resultDelta;
        }

        return right.score - left.score;
      })
      .slice(0, 8);
  }

  private findCurrentOperationalAuthorityDocument(
    documents: OperationalAuthorityDocument[],
    profile: OperationalAuthorityProfile | null,
  ): OperationalAuthorityDocument | null {
    if (profile) {
      const matched = documents.find(
        (document) => document.id === profile.operationalAuthorityDocumentId,
      );
      if (matched) {
        return matched;
      }
    }

    return documents.find((document) => document.status === "active") ?? null;
  }

  private findCurrentInsuranceDocument(
    documents: InsuranceDocument[],
    profile: InsuranceProfile | null,
  ): InsuranceDocument | null {
    if (profile) {
      const matched = documents.find(
        (document) => document.id === profile.insuranceDocumentId,
      );
      if (matched) {
        return matched;
      }
    }

    return documents.find((document) => document.status === "active") ?? null;
  }

  private buildOverallHeadline(params: {
    missionCount: number;
    immediateAttentionMissions: number;
    reviewMissions: number;
    alertCount: number;
    overallResult: RiskMapResult;
  }): string {
    if (params.overallResult === "fail") {
      return `Immediate accountable attention is required across ${params.immediateAttentionMissions} mission(s) and ${params.alertCount} organisation-level alert(s).`;
    }

    if (params.overallResult === "warning") {
      return `Emerging governance pressure is visible across ${params.reviewMissions} mission(s); early intervention should keep operations efficient.`;
    }

    if (params.missionCount === 0) {
      return "No current missions are recorded, and the organisation-level posture is stable.";
    }

    return `Current mission and governance posture is stable across ${params.missionCount} tracked mission(s).`;
  }

  private hasCategoryResult(
    riskMap: MissionRiskMap,
    categoryCode: RiskMapCategory["code"],
    allowedResults: RiskMapResult[],
  ): boolean {
    return riskMap.categories.some(
      (category) =>
        category.code === categoryCode &&
        allowedResults.includes(category.result),
    );
  }

  private resolveOverallResult(results: RiskMapResult[]): RiskMapResult {
    if (results.includes("fail")) {
      return "fail";
    }

    if (results.includes("warning")) {
      return "warning";
    }

    return "pass";
  }

  private toThreatLevel(result: RiskMapResult): RiskMapThreatLevel {
    if (result === "fail") {
      return "immediate";
    }

    if (result === "warning") {
      return "emerging";
    }

    return "stable";
  }

  private resultWeight(result: RiskMapResult): number {
    if (result === "fail") {
      return 2;
    }

    if (result === "warning") {
      return 1;
    }

    return 0;
  }
}
