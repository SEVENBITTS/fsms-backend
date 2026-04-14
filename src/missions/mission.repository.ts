import { PoolClient } from "pg";
import { MissionSequenceAllocator } from "./mission-event.repository";

export type DbTx = PoolClient;

export interface MissionRow {
  id: string;
  status: string;
  mission_plan_id: string | null;
  last_event_sequence_no: number;
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
  async getForUpdate(tx: DbTx, missionId: string): Promise<MissionRow> {
    const result = await tx.query<MissionRow>(
      `
      select
        id,
        status,
        mission_plan_id,
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