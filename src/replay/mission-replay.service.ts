import type { Pool } from "pg";
import { MissionRepository } from "../missions/mission.repository";
import { MissionTelemetryRepository } from "../missions/mission-telemetry.repository";
import { validateMissionReplayQuery } from "./mission-replay.validators";
import type {
  MissionReplayQuery,
  MissionReplayResult,
} from "./mission-replay.types";

export class MissionReplayService {
  constructor(
    private readonly pool: Pool,
    private readonly missionRepo: MissionRepository,
    private readonly telemetryRepo: MissionTelemetryRepository,
  ) {}

  async getMissionReplay(
    missionId: string,
    query: MissionReplayQuery,
  ): Promise<MissionReplayResult> {
    const validated = validateMissionReplayQuery(query);
    const client = await this.pool.connect();

    try {
      const mission = await this.missionRepo.getById(client, missionId);
      const rows = await this.telemetryRepo.findReplayByMissionId(
        mission.id,
        client,
        validated,
      );

      return {
        missionId: mission.id,
        replay: rows.map((row) => ({
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
