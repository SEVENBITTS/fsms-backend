import type { Pool, PoolClient } from "pg";
import { AlertRepository } from "./alert.repository";
import type {
  Alert,
  AlertType,
  CreateAlertInput,
  RegulatoryAmendmentAlertInput,
  RegulatoryAmendmentAlertResult,
} from "./alert.types";

export interface AlertThresholdConfig {
  altitudeHighM: number;
  speedHighMps: number;
}

export interface TelemetryAlertInput {
  timestamp: string;
  lat: number | null;
  lng: number | null;
  altitudeM?: number | null;
  speedMps?: number | null;
  headingDeg?: number | null;
  progressPct?: number | null;
  payload?: Record<string, unknown>;
}

export interface EvaluateTelemetryAlertsResult {
  created: Alert[];
  resolvedCount: number;
}

const DEFAULT_THRESHOLDS: AlertThresholdConfig = {
  altitudeHighM: 1000,
  speedHighMps: 50,
};

export class AlertService {
  constructor(
    private readonly pool: Pool,
    private readonly alertRepository: AlertRepository,
    private readonly thresholds: AlertThresholdConfig = DEFAULT_THRESHOLDS,
  ) {}

  async listAlertsForMission(missionId: string): Promise<Alert[]> {
    const client = await this.pool.connect();

    try {
      return await this.alertRepository.list(client, {
        missionId,
        limit: 100,
      });
    } finally {
      client.release();
    }
  }


  async evaluateTelemetry(
    missionId: string,
    telemetry: TelemetryAlertInput,
  ): Promise<EvaluateTelemetryAlertsResult> {
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      const result = await this.evaluateTelemetryInTx(client, missionId, telemetry);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async evaluateTelemetryInTx(
    client: PoolClient,
    missionId: string,
    telemetry: TelemetryAlertInput,
  ): Promise<EvaluateTelemetryAlertsResult> {
    const created: Alert[] = [];
    let resolvedCount = 0;

    const altitudeTriggered =
      telemetry.altitudeM != null &&
      telemetry.altitudeM > this.thresholds.altitudeHighM;

    const speedTriggered =
      telemetry.speedMps != null &&
      telemetry.speedMps > this.thresholds.speedHighMps;

    const altitudeResult = await this.syncThresholdAlert(
      client,
      missionId,
      "ALTITUDE_HIGH",
      altitudeTriggered,
      telemetry,
      {
        severity: "warning",
        message: "Altitude exceeded configured threshold",
        metadata: {
          threshold: this.thresholds.altitudeHighM,
          actual: telemetry.altitudeM ?? null,
          unit: "m",
          telemetryTimestamp: telemetry.timestamp,
        },
      },
    );

    created.push(...altitudeResult.created);
    resolvedCount += altitudeResult.resolvedCount;

    const speedResult = await this.syncThresholdAlert(
      client,
      missionId,
      "SPEED_HIGH",
      speedTriggered,
      telemetry,
      {
        severity: "critical",
        message: "Speed exceeded configured threshold",
        metadata: {
          threshold: this.thresholds.speedHighMps,
          actual: telemetry.speedMps ?? null,
          unit: "mps",
          telemetryTimestamp: telemetry.timestamp,
        },
      },
    );

    created.push(...speedResult.created);
    resolvedCount += speedResult.resolvedCount;

    return {
      created,
      resolvedCount,
    };
  }

  async recordRegulatoryAmendmentImpact(
    missionId: string,
    input: RegulatoryAmendmentAlertInput,
  ): Promise<RegulatoryAmendmentAlertResult> {
    const amendment = this.normalizeRegulatoryAmendment(input);
    const client = await this.pool.connect();

    try {
      await client.query("begin");

      const existingOpen = await this.alertRepository.listOpenByMissionAndType(
        client,
        missionId,
        "REGULATORY_AMENDMENT",
      );
      const duplicate = existingOpen.some(
        (alert) =>
          alert.metadata.sourceDocument === amendment.sourceDocument &&
          alert.metadata.currentVersion === amendment.currentVersion,
      );

      if (duplicate) {
        await client.query("commit");
        return { created: [], duplicate: true };
      }

      const alert = await this.alertRepository.insert(client, {
        missionId,
        alertType: "REGULATORY_AMENDMENT",
        severity: "warning",
        message: `Regulatory amendment detected: ${amendment.sourceDocument} ${amendment.previousVersion} -> ${amendment.currentVersion}`,
        triggeredAt: amendment.publishedAt,
        metadata: { ...amendment },
        source: "regulatory",
      });

      await client.query("commit");
      return { created: [alert], duplicate: false };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  private async syncThresholdAlert(
    client: PoolClient,
    missionId: string,
    alertType: AlertType,
    triggered: boolean,
    telemetry: TelemetryAlertInput,
    template: Pick<CreateAlertInput, "severity" | "message"> & {
      metadata: Record<string, unknown>;
    },
  ): Promise<EvaluateTelemetryAlertsResult> {
    if (triggered) {
      const existingOpen = await this.alertRepository.listOpenByMissionAndType(
        client,
        missionId,
        alertType,
      );

      if (existingOpen.length > 0) {
        return { created: [], resolvedCount: 0 };
      }

      const created = await this.alertRepository.insert(client, {
        missionId,
        alertType,
        severity: template.severity,
        message: template.message,
        triggeredAt: telemetry.timestamp,
        metadata: {
          ...template.metadata,
          lat: telemetry.lat,
          lng: telemetry.lng,
        },
        source: "telemetry",
      });

      return { created: [created], resolvedCount: 0 };
    }

    const resolvedCount = await this.alertRepository.resolveOpenByMissionAndType(
      client,
      missionId,
      alertType,
      telemetry.timestamp,
    );

    return { created: [], resolvedCount };
  }

  private normalizeRegulatoryAmendment(
    input: RegulatoryAmendmentAlertInput,
  ): RegulatoryAmendmentAlertInput {
    const sourceDocument = input.sourceDocument.trim();
    const previousVersion = input.previousVersion.trim();
    const currentVersion = input.currentVersion.trim();
    const amendmentSummary = input.amendmentSummary.trim();
    const changeImpact = input.changeImpact.trim();
    const reviewAction = input.reviewAction.trim();

    if (
      !sourceDocument ||
      !previousVersion ||
      !currentVersion ||
      !input.publishedAt ||
      !amendmentSummary ||
      !changeImpact ||
      !reviewAction
    ) {
      throw new Error("Regulatory amendment alerts require source, version, change, and review details");
    }

    return {
      sourceDocument,
      previousVersion,
      currentVersion,
      publishedAt: input.publishedAt,
      effectiveFrom: input.effectiveFrom ?? null,
      amendmentSummary,
      changeImpact,
      affectedRequirementRefs: input.affectedRequirementRefs ?? [],
      reviewAction,
    };
  }
}
