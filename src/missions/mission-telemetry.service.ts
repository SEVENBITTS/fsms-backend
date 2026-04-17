import type { Pool } from "pg";
import { MissionRepository } from "./mission.repository";
import { MissionLifecyclePolicy } from "./mission-lifecycle.policy";
import { MissionNotActiveError } from "./mission-telemetry.errors";
import { toMissionTelemetryRow } from "./mission-telemetry.mapper";
import { MissionTelemetryRepository } from "./mission-telemetry.repository";
import type {
  MissionTelemetryBatchInput,
  MissionTelemetryHistoryQuery,
  MissionTelemetryHistoryResult,
  LatestMissionTelemetryResult,
  RecordMissionTelemetryResult,
} from "./mission-telemetry.types";
import { validateMissionTelemetryBatch } from "./mission-telemetry.validators";
import { validateMissionTelemetryHistoryQuery } from "./mission-telemetry-history.validators";
import { AlertService } from "../alerts/alert.service";

export class MissionTelemetryService {
  constructor(
    private readonly pool: Pool,
    private readonly missionRepo: MissionRepository,
    private readonly telemetryRepo: MissionTelemetryRepository,
    private readonly lifecyclePolicy: MissionLifecyclePolicy,
    private readonly alertService: AlertService,
  ) {}

  async recordTelemetry(
    missionId: string,
    input: MissionTelemetryBatchInput,
  ): Promise<RecordMissionTelemetryResult> {
    validateMissionTelemetryBatch(input);

    const client = await this.pool.connect();

    try {
      await client.query("begin");

      const mission = await this.missionRepo.getById(client, missionId);

      if (!this.lifecyclePolicy.canAcceptTelemetry(mission.status)) {
        throw new MissionNotActiveError(mission.id, mission.status);
      }

      const rows = input.records.map((record) =>
        toMissionTelemetryRow(missionId, record),
      );

      await this.telemetryRepo.insertMany(rows, client);

      for (const record of input.records) {
        await this.alertService.evaluateTelemetryInTx(client, missionId, {
          timestamp: record.timestamp,
          lat: record.lat ?? null,
          lng: record.lng ?? null,
          altitudeM: record.altitudeM ?? null,
          speedMps: record.speedMps ?? null,
          headingDeg: record.headingDeg ?? null,
          progressPct: record.progressPct ?? null,
          payload: record.payload ?? {},
        });
      }

      await client.query("commit");

      return {
        missionId,
        accepted: rows.length,
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async getLatestTelemetry(
    missionId: string,
  ): Promise<LatestMissionTelemetryResult> {
    const client = await this.pool.connect();

    try {
      const mission = await this.missionRepo.getById(client, missionId);

      const latest = await this.telemetryRepo.findLatestByMissionId(
        missionId,
        client,
      );

      if (!latest) {
        return {
          missionId: mission.id,
          telemetry: null,
        };
      }

      return {
        missionId: mission.id,
        telemetry: {
          timestamp: latest.recordedAt.toISOString(),
          lat: latest.lat,
          lng: latest.lng,
          altitudeM: latest.altitudeM,
          speedMps: latest.speedMps,
          headingDeg: latest.headingDeg,
          progressPct: latest.progressPct,
          payload: latest.payload,
        },
      };
    } finally {
      client.release();
    }
  }

  async getTelemetryHistory(
    missionId: string,
    query: MissionTelemetryHistoryQuery,
  ): Promise<MissionTelemetryHistoryResult> {
    const validated = validateMissionTelemetryHistoryQuery(query);

    const client = await this.pool.connect();

    try {
      const mission = await this.missionRepo.getById(client, missionId);

      const rows = await this.telemetryRepo.findHistoryByMissionId(
        missionId,
        client,
        validated,
      );

      return {
        missionId: mission.id,
        records: rows.map((row) => ({
          timestamp: row.recordedAt.toISOString(),
          lat: row.lat,
          lng: row.lng,
          altitudeM: row.altitudeM,
          speedMps: row.speedMps,
          headingDeg: row.headingDeg,
          progressPct: row.progressPct,
          payload: row.payload,
        })),
      };
    } finally {
      client.release();
    }
  }
}