import { PoolClient } from "pg";
import { MissionSequenceAllocator } from "./mission-event.repository";
import type { MissionStatus } from "./mission-telemetry.types";

export type DbTx = PoolClient;

export interface MissionRow {
  id: string;
  status: MissionStatus;
  mission_plan_id: string | null;
  platform_id: string | null;
  pilot_id: string | null;
  last_event_sequence_no: number;
}

export interface MissionListRow {
  id: string;
  status: MissionStatus;
  mission_plan_id: string | null;
  platform_id: string | null;
  pilot_id: string | null;
  last_event_sequence_no: number;
  platform_name: string | null;
  pilot_display_name: string | null;
  latest_event_type: string | null;
  latest_event_summary: string | null;
  latest_event_time: string | null;
}

type AppError = Error & {
  statusCode: number;
  code: string;
};

const makeAppError = (
  message: string,
  statusCode: number,
  code: string,
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

export class MissionRepository implements MissionSequenceAllocator {
  async list(
    tx: DbTx,
    params: { query?: string; limit: number },
  ): Promise<MissionListRow[]> {
    const search = params.query?.trim() ?? "";
    const searchPattern = search ? `%${search.toLowerCase()}%` : null;

    const result = await tx.query<MissionListRow>(
      `
      select
        missions.id,
        missions.status,
        missions.mission_plan_id,
        missions.platform_id,
        missions.pilot_id,
        missions.last_event_sequence_no,
        platforms.name as platform_name,
        pilots.display_name as pilot_display_name,
        latest_event.event_type as latest_event_type,
        latest_event.summary as latest_event_summary,
        latest_event.event_ts::text as latest_event_time
      from missions
      left join platforms
        on platforms.id = missions.platform_id
      left join pilots
        on pilots.id = missions.pilot_id
      left join lateral (
        select
          mission_events.event_type,
          mission_events.summary,
          mission_events.event_ts
        from mission_events
        where mission_events.mission_id = missions.id
        order by mission_events.event_ts desc, mission_events.id desc
        limit 1
      ) as latest_event on true
      where (
        $1::text is null
        or lower(missions.id::text) like $1
        or lower(coalesce(missions.mission_plan_id, '')) like $1
        or lower(missions.status) like $1
        or lower(coalesce(platforms.name, '')) like $1
        or lower(coalesce(pilots.display_name, '')) like $1
      )
      order by
        coalesce(latest_event.event_ts, 'epoch'::timestamptz) desc,
        missions.last_event_sequence_no desc,
        missions.id desc
      limit $2
      `,
      [searchPattern, params.limit],
    );

    return result.rows.map((row) => ({
      ...row,
      last_event_sequence_no: Number(row.last_event_sequence_no),
    }));
  }

  async getForUpdate(tx: DbTx, missionId: string): Promise<MissionRow> {
    const result = await tx.query<MissionRow>(
      `
      select
        id,
        status,
        mission_plan_id,
        platform_id,
        pilot_id,
        last_event_sequence_no
      from missions
      where id = $1
      for update
      `,
      [missionId],
    );

    if (result.rowCount !== 1) {
      throw makeAppError(
        `Mission not found: ${missionId}`,
        404,
        "MISSION_NOT_FOUND",
      );
    }

    return {
      ...result.rows[0],
      last_event_sequence_no: Number(result.rows[0].last_event_sequence_no),
    };
  }

  async updateStatus(
    tx: DbTx,
    missionId: string,
    nextStatus: string,
  ): Promise<void> {
    const result = await tx.query(
      `
      update missions
      set status = $2
      where id = $1
      `,
      [missionId, nextStatus],
    );

    if (result.rowCount !== 1) {
      throw makeAppError(
        `Failed to update mission status: ${missionId}`,
        500,
        "MISSION_STATUS_UPDATE_FAILED",
      );
    }
  }

  async getById(tx: DbTx, missionId: string): Promise<MissionRow> {
    const result = await tx.query<MissionRow>(
      `
      select
        id,
        status,
        mission_plan_id,
        platform_id,
        pilot_id,
        last_event_sequence_no
      from missions
      where id = $1
      `,
      [missionId],
    );

    if (result.rowCount !== 1) {
      throw makeAppError(
        `Mission ${missionId} not found`,
        404,
        "MISSION_NOT_FOUND",
      );
    }

    return {
      ...result.rows[0],
      last_event_sequence_no: Number(result.rows[0].last_event_sequence_no),
    };
  }

  async bumpLastEventSequence(tx: DbTx, missionId: string): Promise<number> {
    const result = await tx.query<{ last_event_sequence_no: number }>(
      `
      update missions
      set last_event_sequence_no = last_event_sequence_no + 1
      where id = $1
      returning last_event_sequence_no
      `,
      [missionId],
    );

    if (result.rowCount !== 1) {
      throw makeAppError(
        `Failed to bump event sequence for mission: ${missionId}`,
        500,
        "MISSION_SEQUENCE_BUMP_FAILED",
      );
    }

    return Number(result.rows[0].last_event_sequence_no);
  }
}
