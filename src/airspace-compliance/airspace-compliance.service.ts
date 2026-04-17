import type { Pool } from "pg";
import {
  AirspaceComplianceMissionNotFoundError,
} from "./airspace-compliance.errors";
import { AirspaceComplianceRepository } from "./airspace-compliance.repository";
import type {
  AirspaceComplianceAssessment,
  AirspaceComplianceInput,
  AirspaceComplianceReason,
  AirspaceComplianceResult,
  CreateAirspaceComplianceInput,
} from "./airspace-compliance.types";
import { validateCreateAirspaceComplianceInput } from "./airspace-compliance.validators";

export class AirspaceComplianceService {
  constructor(
    private readonly pool: Pool,
    private readonly airspaceRepository: AirspaceComplianceRepository,
  ) {}

  async createAirspaceComplianceInput(
    missionId: string,
    input: CreateAirspaceComplianceInput,
  ): Promise<AirspaceComplianceInput> {
    const validated = validateCreateAirspaceComplianceInput(input);
    const client = await this.pool.connect();

    try {
      const exists = await this.airspaceRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new AirspaceComplianceMissionNotFoundError(missionId);
      }

      return await this.airspaceRepository.insertAirspaceComplianceInput(
        client,
        {
          missionId,
          ...validated,
        },
      );
    } finally {
      client.release();
    }
  }

  async assessAirspaceCompliance(
    missionId: string,
  ): Promise<AirspaceComplianceAssessment> {
    const client = await this.pool.connect();

    try {
      const exists = await this.airspaceRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new AirspaceComplianceMissionNotFoundError(missionId);
      }

      const input =
        await this.airspaceRepository.getLatestAirspaceComplianceInput(
          client,
          missionId,
        );

      if (!input) {
        return {
          missionId,
          result: "fail",
          reasons: [
            {
              code: "AIRSPACE_INPUT_MISSING",
              severity: "fail",
              message: "Mission has no airspace compliance inputs",
            },
          ],
          input: null,
        };
      }

      const reasons = this.buildComplianceReasons(input);

      return {
        missionId,
        result: this.getComplianceResult(reasons),
        reasons,
        input,
      };
    } finally {
      client.release();
    }
  }

  private buildComplianceReasons(
    input: AirspaceComplianceInput,
  ): AirspaceComplianceReason[] {
    const reasons: AirspaceComplianceReason[] = [];

    if (input.restrictionStatus === "prohibited") {
      reasons.push({
        code: "AIRSPACE_PROHIBITED",
        severity: "fail",
        message: "Mission intersects prohibited airspace",
      });
    }

    if (input.permissionStatus === "denied") {
      reasons.push({
        code: "AIRSPACE_PERMISSION_DENIED",
        severity: "fail",
        message: "Required airspace permission has been denied",
      });
    }

    if (
      input.restrictionStatus === "restricted" &&
      input.permissionStatus !== "granted"
    ) {
      reasons.push({
        code: "AIRSPACE_RESTRICTED",
        severity: "fail",
        message: "Restricted airspace requires granted permission before dispatch",
      });
    }

    if (input.permissionStatus === "pending") {
      reasons.push({
        code: "AIRSPACE_PERMISSION_PENDING",
        severity: "warning",
        message: "Airspace permission is pending and requires review",
      });
    }

    if (input.restrictionStatus === "permission_required") {
      reasons.push({
        code: "AIRSPACE_PERMISSION_REQUIRED",
        severity: input.permissionStatus === "granted" ? "pass" : "warning",
        message: "Mission requires airspace permission evidence",
      });
    }

    if (input.controlledAirspace) {
      reasons.push({
        code: "AIRSPACE_CONTROLLED",
        severity: input.permissionStatus === "granted" ? "pass" : "warning",
        message: "Mission includes controlled airspace",
      });
    }

    if (input.nearbyAerodrome) {
      reasons.push({
        code: "AIRSPACE_NEAR_AERODROME",
        severity: "warning",
        message: "Mission is near an aerodrome and requires explicit review",
      });
    }

    if (input.maxAltitudeFt > 400 && input.permissionStatus !== "granted") {
      reasons.push({
        code: "AIRSPACE_ALTITUDE_REVIEW",
        severity: "warning",
        message: "Mission altitude exceeds 400 ft and requires permission review",
      });
    }

    if (reasons.length === 0) {
      reasons.push({
        code: "AIRSPACE_CLEAR",
        severity: "pass",
        message: "Airspace compliance inputs are clear for planning",
      });
    }

    return reasons;
  }

  private getComplianceResult(
    reasons: AirspaceComplianceReason[],
  ): AirspaceComplianceResult {
    if (reasons.some((reason) => reason.severity === "fail")) {
      return "fail";
    }

    if (reasons.some((reason) => reason.severity === "warning")) {
      return "warning";
    }

    return "pass";
  }
}
