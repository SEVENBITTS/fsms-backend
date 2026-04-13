import { PoolClient } from "pg";
import { MissionSequenceAllocator } from "./mission-event.repository";

export type DbTx = PoolClient;

export interface MissionRow {
  id: string;
  status: string;
  mission_plan_id: string | null;
  last_event_sequence_no: number;
}

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
      throw new Error(`Mission not found: ${missionId}`);
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
      throw new Error(`Failed to update mission status: ${missionId}`);
    }
  }

  async getById(tx: any, missionId: string) {
  const result = await tx.query(
    `
    SELECT id, status, mission_plan_id, last_event_sequence_no
    FROM missions
    WHERE id = $1
    `,
    [missionId],
  );

  if (result.rows.length === 0) {
    throw new Error(`Mission ${missionId} not found`);
  }

  return result.rows[0];
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
      throw new Error(`Failed to bump event sequence for mission: ${missionId}`);
    }

    return Number(result.rows[0].last_event_sequence_no);
  }
}