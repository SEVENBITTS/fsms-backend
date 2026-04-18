import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";

interface MissionPlanningDraftRow extends QueryResultRow {
  id: string;
  status: "draft";
  mission_plan_id: string | null;
  platform_id: string | null;
  pilot_id: string | null;
  risk_input_present: boolean;
  airspace_input_present: boolean;
}

export class MissionPlanningRepository {
  async platformExists(tx: PoolClient, platformId: string): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from platforms
      where id = $1
      `,
      [platformId],
    );

    return result.rowCount === 1;
  }

  async pilotExists(tx: PoolClient, pilotId: string): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from pilots
      where id = $1
      `,
      [pilotId],
    );

    return result.rowCount === 1;
  }

  async insertDraftMission(
    tx: PoolClient,
    input: {
      missionPlanId: string | null;
      platformId: string | null;
      pilotId: string | null;
    },
  ): Promise<string> {
    const result = await tx.query<{ id: string }>(
      `
      insert into missions (
        id,
        status,
        mission_plan_id,
        platform_id,
        pilot_id,
        last_event_sequence_no
      )
      values ($1, 'draft', $2, $3, $4, 0)
      returning id
      `,
      [randomUUID(), input.missionPlanId, input.platformId, input.pilotId],
    );

    return result.rows[0].id;
  }

  async getDraftMission(
    tx: PoolClient,
    missionId: string,
  ): Promise<MissionPlanningDraftRow | null> {
    const result = await tx.query<MissionPlanningDraftRow>(
      `
      select
        missions.id,
        missions.status,
        missions.mission_plan_id,
        missions.platform_id,
        missions.pilot_id,
        exists (
          select 1
          from mission_risk_inputs risk
          where risk.mission_id = missions.id
        ) as risk_input_present,
        exists (
          select 1
          from airspace_compliance_inputs airspace
          where airspace.mission_id = missions.id
        ) as airspace_input_present
      from missions
      where missions.id = $1
        and missions.status = 'draft'
      `,
      [missionId],
    );

    return result.rows[0] ?? null;
  }
}
