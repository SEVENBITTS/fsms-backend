import type { Pool } from "pg";
import { PilotService } from "../pilots/pilot.service";
import { PlatformService } from "../platforms/platform.service";
import { MissionGovernanceService } from "../mission-governance/mission-governance.service";
import { RiskMapMissionNotFoundError } from "./risk-map.errors";
import { RiskMapRepository } from "./risk-map.repository";
import type {
  MissionRiskMap,
  RiskMapCategory,
  RiskMapResult,
  RiskMapThreatLevel,
} from "./risk-map.types";

export class RiskMapService {
  constructor(
    private readonly pool: Pool,
    private readonly riskMapRepository: RiskMapRepository,
    private readonly missionGovernanceService: MissionGovernanceService,
    private readonly platformService: PlatformService,
    private readonly pilotService: PilotService,
  ) {}

  async getMissionRiskMap(missionId: string): Promise<MissionRiskMap> {
    const client = await this.pool.connect();

    try {
      const missionContext = await this.riskMapRepository.getMissionContext(
        client,
        missionId,
      );

      if (!missionContext) {
        throw new RiskMapMissionNotFoundError(missionId);
      }

      const governance =
        await this.missionGovernanceService.assessMissionGovernance(missionId);
      const platformMaintenance = missionContext.platformId
        ? await this.platformService.checkPlatformReadiness(
            missionContext.platformId,
          )
        : null;
      const pilotCompetency = missionContext.pilotId
        ? await this.pilotService.checkPilotReadiness(missionContext.pilotId)
        : null;
      const overridePressure =
        await this.riskMapRepository.getOverridePressureSummary(client, missionId);

      const categories: RiskMapCategory[] = [
        this.buildOperationalAuthorityCategory(governance),
        this.buildInsuranceCategory(governance),
        this.buildPilotCompetencyCategory(pilotCompetency),
        this.buildPlatformMaintenanceCategory(platformMaintenance),
        this.buildOverridePressureCategory(overridePressure),
      ];

      const overallResult = this.resolveOverallResult(
        categories.map((category) => category.result),
      );

      return {
        missionId,
        organisationId: missionContext.organisationId,
        overall: {
          result: overallResult,
          threatLevel: this.toThreatLevel(overallResult),
          score: this.calculateScore(categories),
        },
        stageMap: [
          {
            stage: "governance",
            result: categories[0].result,
            threatLevel: categories[0].threatLevel,
          },
          {
            stage: "insurance",
            result: categories[1].result,
            threatLevel: categories[1].threatLevel,
          },
          {
            stage: "competency",
            result: categories[2].result,
            threatLevel: categories[2].threatLevel,
          },
          {
            stage: "maintenance",
            result: categories[3].result,
            threatLevel: categories[3].threatLevel,
          },
          {
            stage: "override",
            result: categories[4].result,
            threatLevel: categories[4].threatLevel,
          },
        ],
        categories,
        governance,
        pilotCompetency,
        platformMaintenance,
        overridePressure,
      };
    } finally {
      client.release();
    }
  }

  private buildOperationalAuthorityCategory(
    governance: MissionRiskMap["governance"],
  ): RiskMapCategory {
    const reasons = governance.operationalAuthority.reasons;
    const result = governance.operationalAuthority.result;
    const document = governance.operationalAuthority.document;

    return {
      code: "oa_renewal",
      label: "Operational Authority",
      result,
      threatLevel: this.toThreatLevel(result),
      headline:
        result === "fail"
          ? "Operational authority needs immediate attention."
          : result === "warning"
            ? "Operational authority is drifting toward renewal or review pressure."
            : "Operational authority is currently recorded as healthy.",
      signals: [
        ...reasons.map((reason) => reason.message),
        ...(document ? [`OA expires at ${document.expiresAt}`] : []),
      ],
      recommendedActions:
        result === "fail"
          ? [
              "Confirm a current OA is in force and replace expired or inactive records.",
              "Review whether the planned operation is still inside the recorded authorised envelope.",
            ]
          : result === "warning"
            ? [
                "Prepare renewal or amendment evidence before the OA becomes an operational constraint.",
                "Review accountable sign-off on the current OA profile.",
              ]
            : ["Continue monitoring OA validity and change triggers."],
    };
  }

  private buildInsuranceCategory(
    governance: MissionRiskMap["governance"],
  ): RiskMapCategory {
    const reasons = governance.insurance.reasons;
    const result = governance.insurance.result;
    const document = governance.insurance.document;

    return {
      code: "insurance_renewal",
      label: "Insurance",
      result,
      threatLevel: this.toThreatLevel(result),
      headline:
        result === "fail"
          ? "Insurance evidence needs immediate attention."
          : result === "warning"
            ? "Insurance is drifting toward renewal or review pressure."
            : "Insurance is currently recorded as healthy.",
      signals: [
        ...reasons.map((reason) => reason.message),
        ...(document ? [`Insurance expires at ${document.expiresAt}`] : []),
      ],
      recommendedActions:
        result === "fail"
          ? [
              "Confirm the operator has current cover recorded for this mission type.",
              "Replace expired insurance evidence before treating the mission as fully compliant.",
            ]
          : result === "warning"
            ? [
                "Prepare renewal evidence before cover becomes an operational threat.",
                "Review whether any mission-type or BVLOS cover conditions need amendment.",
              ]
            : ["Continue monitoring insurance validity and cover scope."],
    };
  }

  private buildPilotCompetencyCategory(
    pilotCompetency: MissionRiskMap["pilotCompetency"],
  ): RiskMapCategory {
    const result = pilotCompetency?.result ?? "warning";

    return {
      code: "pilot_competency",
      label: "Pilot Competency",
      result,
      threatLevel: this.toThreatLevel(result),
      headline:
        pilotCompetency === null
          ? "No pilot is assigned to this mission."
          : result === "fail"
            ? "Pilot competency evidence needs immediate attention."
            : result === "warning"
              ? "Pilot competency requires review."
              : "Pilot competency is currently healthy.",
      signals:
        pilotCompetency?.reasons.map((reason) => reason.message) ?? [
          "No assigned pilot is available for readiness evaluation.",
        ],
      recommendedActions:
        pilotCompetency === null
          ? ["Assign a pilot so competency evidence can be evaluated."]
          : result === "fail"
            ? [
                "Refresh or replace expired or revoked pilot evidence.",
                "Confirm the assigned pilot remains current for the intended operation.",
              ]
            : result === "warning"
              ? [
                  "Review inactive pilot status or evidence before dispatch reliance.",
                ]
              : ["Continue monitoring pilot evidence validity and currency."],
    };
  }

  private buildPlatformMaintenanceCategory(
    platformMaintenance: MissionRiskMap["platformMaintenance"],
  ): RiskMapCategory {
    const result = platformMaintenance?.result ?? "warning";

    return {
      code: "platform_maintenance",
      label: "Platform Maintenance",
      result,
      threatLevel: this.toThreatLevel(result),
      headline:
        platformMaintenance === null
          ? "No platform is assigned to this mission."
          : result === "fail"
            ? "Platform maintenance status needs immediate attention."
            : result === "warning"
              ? "Platform maintenance is becoming an operational pressure point."
              : "Platform maintenance is currently healthy.",
      signals:
        platformMaintenance?.reasons.map((reason) => reason.message) ?? [
          "No assigned platform is available for maintenance evaluation.",
        ],
      recommendedActions:
        platformMaintenance === null
          ? ["Assign a platform so maintenance exposure can be evaluated."]
          : result === "fail"
            ? [
                "Resolve grounded or retired platform status before mission reliance.",
              ]
            : result === "warning"
              ? [
                  "Complete or reschedule due maintenance before it creates dispatch delay.",
                  "Review overdue maintenance items against the platform schedule.",
                ]
              : ["Continue monitoring scheduled maintenance and flight-hour thresholds."],
    };
  }

  private buildOverridePressureCategory(
    overridePressure: MissionRiskMap["overridePressure"],
  ): RiskMapCategory {
    const hasOverrideEvents = overridePressure.overrideEventCount > 0;
    const hasReviewPressure =
      overridePressure.reviewRequiredSnapshotCount > 0 ||
      overridePressure.latestSnapshotRequiresReview;

    const result: RiskMapResult =
      hasOverrideEvents && hasReviewPressure
        ? "fail"
        : hasOverrideEvents || hasReviewPressure
          ? "warning"
          : "pass";

    const signals: string[] = [];

    if (hasOverrideEvents) {
      signals.push(
        `${overridePressure.overrideEventCount} override event(s) recorded for this mission.`,
      );
    } else {
      signals.push("No override events are currently recorded for this mission.");
    }

    if (hasReviewPressure) {
      signals.push(
        `${overridePressure.reviewRequiredSnapshotCount} readiness snapshot(s) required review.`,
      );
    } else {
      signals.push("No review-required readiness snapshots are currently recorded.");
    }

    if (overridePressure.latestOverrideAt) {
      signals.push(`Latest override recorded at ${overridePressure.latestOverrideAt}.`);
    }

    return {
      code: "override_pressure",
      label: "Override Pressure",
      result,
      threatLevel: this.toThreatLevel(result),
      headline:
        result === "fail"
          ? "Override pressure is high and should be investigated immediately."
          : result === "warning"
            ? "Override pressure is emerging and should be reviewed."
            : "Override pressure is currently low.",
      signals,
      recommendedActions:
        result === "fail"
          ? [
              "Review why overrides are being used alongside review-required readiness states.",
              "Check whether SOP, OA, or insurance conditions need amendment to reduce repeated pressure.",
            ]
          : result === "warning"
            ? [
                "Review recent overrides or review-required snapshots for trend growth.",
              ]
            : ["Continue monitoring override activity as an early-warning signal."],
    };
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

  private calculateScore(categories: RiskMapCategory[]): number {
    const base = categories.reduce((total, category) => {
      if (category.result === "fail") {
        return total + 25;
      }

      if (category.result === "warning") {
        return total + 12;
      }

      return total;
    }, 0);

    return Math.min(base, 100);
  }
}
