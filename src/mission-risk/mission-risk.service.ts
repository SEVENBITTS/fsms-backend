import type { Pool } from "pg";
import { MissionRiskMissionNotFoundError } from "./mission-risk.errors";
import { MissionRiskRepository } from "./mission-risk.repository";
import type {
  CreateMissionRiskInput,
  MissionRiskAssessment,
  MissionRiskBand,
  MissionRiskInput,
  MissionRiskReason,
  MissionRiskResult,
  OperatingCategory,
  RiskLevel,
} from "./mission-risk.types";
import { validateCreateMissionRiskInput } from "./mission-risk.validators";

const CATEGORY_SCORE: Record<OperatingCategory, number> = {
  open: 0,
  specific: 2,
  certified: 4,
};

const LEVEL_SCORE: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export class MissionRiskService {
  constructor(
    private readonly pool: Pool,
    private readonly missionRiskRepository: MissionRiskRepository,
  ) {}

  async createMissionRiskInput(
    missionId: string,
    input: CreateMissionRiskInput,
  ): Promise<MissionRiskInput> {
    const validated = validateCreateMissionRiskInput(input);
    const client = await this.pool.connect();

    try {
      const exists = await this.missionRiskRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new MissionRiskMissionNotFoundError(missionId);
      }

      return await this.missionRiskRepository.insertMissionRiskInput(client, {
        missionId,
        ...validated,
      });
    } finally {
      client.release();
    }
  }

  async assessMissionRisk(missionId: string): Promise<MissionRiskAssessment> {
    const client = await this.pool.connect();

    try {
      const exists = await this.missionRiskRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new MissionRiskMissionNotFoundError(missionId);
      }

      const input = await this.missionRiskRepository.getLatestMissionRiskInput(
        client,
        missionId,
      );

      if (!input) {
        return {
          missionId,
          result: "fail",
          score: null,
          riskBand: null,
          reasons: [
            {
              code: "MISSION_RISK_MISSING",
              severity: "fail",
              message: "Mission has no risk scoring inputs",
            },
          ],
          input: null,
        };
      }

      const score = this.scoreMissionRisk(input);
      const riskBand = this.getRiskBand(score);
      const reasons = this.buildRiskReasons(score, riskBand);

      return {
        missionId,
        result: this.getRiskResult(reasons),
        score,
        riskBand,
        reasons,
        input,
      };
    } finally {
      client.release();
    }
  }

  private scoreMissionRisk(input: MissionRiskInput): number {
    return (
      CATEGORY_SCORE[input.operatingCategory] +
      LEVEL_SCORE[input.missionComplexity] +
      LEVEL_SCORE[input.populationExposure] +
      LEVEL_SCORE[input.airspaceComplexity] +
      LEVEL_SCORE[input.weatherRisk] +
      LEVEL_SCORE[input.payloadRisk]
    );
  }

  private getRiskBand(score: number): MissionRiskBand {
    if (score > 12) {
      return "high";
    }

    if (score > 8) {
      return "moderate";
    }

    return "low";
  }

  private buildRiskReasons(
    score: number,
    riskBand: MissionRiskBand,
  ): MissionRiskReason[] {
    if (riskBand === "high") {
      return [
        {
          code: "MISSION_RISK_HIGH",
          severity: "fail",
          message: `Mission risk score ${score} is high and blocks approval or dispatch`,
        },
      ];
    }

    if (riskBand === "moderate") {
      return [
        {
          code: "MISSION_RISK_ELEVATED",
          severity: "warning",
          message: `Mission risk score ${score} requires explicit review`,
        },
      ];
    }

    return [
      {
        code: "MISSION_RISK_ACCEPTABLE",
        severity: "pass",
        message: `Mission risk score ${score} is acceptable for planning`,
      },
    ];
  }

  private getRiskResult(reasons: MissionRiskReason[]): MissionRiskResult {
    if (reasons.some((reason) => reason.severity === "fail")) {
      return "fail";
    }

    if (reasons.some((reason) => reason.severity === "warning")) {
      return "warning";
    }

    return "pass";
  }
}
