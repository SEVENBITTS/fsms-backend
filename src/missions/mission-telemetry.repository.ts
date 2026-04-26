import type { PoolClient, QueryResultRow } from "pg";
import type {
  MissionTelemetryRangeQuery,
  MissionTelemetryRow,
} from "./mission-telemetry.types";

interface MissionTelemetryRowResult extends QueryResultRow {
  id: string;
  missionId: string;
  recordedAt: Date;
  lat: number | null;
  lng: number | null;
  altitudeM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  progressPct: number | null;
  payload: Record<string, unknown>;
  createdAt?: Date;
}

interface MissionTelemetryTimelineSummaryRow extends QueryResultRow {
  record_count: number;
  first_recorded_at: Date | null;
  last_recorded_at: Date | null;
  latest_lat: number | null;
  latest_lng: number | null;
  latest_altitude_m: number | null;
  latest_speed_mps: number | null;
  latest_heading_deg: number | null;
  latest_progress_pct: number | null;
  latest_payload: Record<string, unknown> | null;
}

export class MissionTelemetryRepository {
  async insertMany(
    rows: MissionTelemetryRow[],
    tx: PoolClient,
  ): Promise<void> {
    if (rows.length === 0) return;

    const values: unknown[] = [];
    const placeholders: string[] = [];

    rows.forEach((row, index) => {
      const offset = index * 10;

      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`,
      );

      values.push(
        row.id,
        row.missionId,
        row.recordedAt,
        row.lat,
        row.lng,
        row.altitudeM,
        row.speedMps,
        row.headingDeg,
        row.progressPct,
        JSON.stringify(row.payload),
      );
    });

    const sql = `
      insert into mission_telemetry (
        id,
        mission_id,
        recorded_at,
        lat,
        lng,
        altitude_m,
        speed_mps,
        heading_deg,
        progress_pct,
        payload
      )
      values ${placeholders.join(", ")}
    `;

    await tx.query(sql, values);
  }

  async findLatestByMissionId(
    missionId: string,
    tx: PoolClient,
  ): Promise<MissionTelemetryRow | null> {
    const result = await tx.query<MissionTelemetryRowResult>(
      `
      select
        id,
        mission_id as "missionId",
        recorded_at as "recordedAt",
        lat,
        lng,
        altitude_m as "altitudeM",
        speed_mps as "speedMps",
        heading_deg as "headingDeg",
        progress_pct as "progressPct",
        payload,
        created_at as "createdAt"
      from mission_telemetry
      where mission_id = $1
      order by recorded_at desc
      limit 1
      `,
      [missionId],
    );

    return result.rows[0] ?? null;
  }

  async findHistoryByMissionId(
    missionId: string,
    tx: PoolClient,
    options: {
      from?: Date;
      to?: Date;
      limit: number;
    },
  ): Promise<MissionTelemetryRow[]> {
    const conditions = [`mission_id = $1`];
    const values: unknown[] = [missionId];

    if (options.from) {
      values.push(options.from);
      conditions.push(`recorded_at >= $${values.length}`);
    }

    if (options.to) {
      values.push(options.to);
      conditions.push(`recorded_at <= $${values.length}`);
    }

    values.push(options.limit);

    const sql = `
      select
        id,
        mission_id as "missionId",
        recorded_at as "recordedAt",
        lat,
        lng,
        altitude_m as "altitudeM",
        speed_mps as "speedMps",
        heading_deg as "headingDeg",
        progress_pct as "progressPct",
        payload,
        created_at as "createdAt"
      from mission_telemetry
      where ${conditions.join(" and ")}
      order by recorded_at desc
      limit $${values.length}
    `;

    const result = await tx.query<MissionTelemetryRowResult>(sql, values);
    return result.rows;
  }

  async findReplayByMissionId(
    missionId: string,
    tx: PoolClient,
    options: MissionTelemetryRangeQuery,
  ): Promise<MissionTelemetryRow[]> {
    const conditions = [`mission_id = $1`];
    const values: unknown[] = [missionId];

    if (options.from) {
      values.push(options.from);
      conditions.push(`recorded_at >= $${values.length}`);
    }

    if (options.to) {
      values.push(options.to);
      conditions.push(`recorded_at <= $${values.length}`);
    }

    const sql = `
      select
        id,
        mission_id as "missionId",
        recorded_at as "recordedAt",
        lat,
        lng,
        altitude_m as "altitudeM",
        speed_mps as "speedMps",
        heading_deg as "headingDeg",
        progress_pct as "progressPct",
        payload,
        created_at as "createdAt"
      from mission_telemetry
      where ${conditions.join(" and ")}
      order by recorded_at asc, created_at asc, id asc
    `;

    const result = await tx.query<MissionTelemetryRowResult>(sql, values);
    return result.rows;
  }

  async getTimelineSummaryByMissionId(
    missionId: string,
    tx: PoolClient,
  ): Promise<{
    recordCount: number;
    firstRecordedAt: Date | null;
    lastRecordedAt: Date | null;
    latestRecord: Omit<MissionTelemetryRow, "id" | "missionId" | "createdAt"> | null;
  }> {
    const result = await tx.query<MissionTelemetryTimelineSummaryRow>(
      `
      with telemetry as (
        select
          recorded_at,
          lat,
          lng,
          altitude_m,
          speed_mps,
          heading_deg,
          progress_pct,
          payload
        from mission_telemetry
        where mission_id = $1
      ),
      latest as (
        select
          recorded_at,
          lat,
          lng,
          altitude_m,
          speed_mps,
          heading_deg,
          progress_pct,
          payload
        from telemetry
        order by recorded_at desc
        limit 1
      )
      select
        count(*)::int as record_count,
        min(recorded_at) as first_recorded_at,
        max(recorded_at) as last_recorded_at,
        (select lat from latest) as latest_lat,
        (select lng from latest) as latest_lng,
        (select altitude_m from latest) as latest_altitude_m,
        (select speed_mps from latest) as latest_speed_mps,
        (select heading_deg from latest) as latest_heading_deg,
        (select progress_pct from latest) as latest_progress_pct,
        (select payload from latest) as latest_payload
      from telemetry
      `,
      [missionId],
    );

    const row = result.rows[0];
    const recordCount = Number(row.record_count ?? 0);

    return {
      recordCount,
      firstRecordedAt: row.first_recorded_at ?? null,
      lastRecordedAt: row.last_recorded_at ?? null,
      latestRecord:
        recordCount > 0 && row.last_recorded_at
          ? {
              recordedAt: row.last_recorded_at,
              lat: row.latest_lat,
              lng: row.latest_lng,
              altitudeM: row.latest_altitude_m,
              speedMps: row.latest_speed_mps,
              headingDeg: row.latest_heading_deg,
              progressPct: row.latest_progress_pct,
              payload: row.latest_payload ?? {},
            }
          : null,
    };
  }
}
