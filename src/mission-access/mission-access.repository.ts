import type { PoolClient, QueryResultRow } from "pg";

interface MissionAccessRow extends QueryResultRow {
  id: string;
  organisation_id: string | null;
  pilot_id: string | null;
  platform_id: string | null;
  operation_type: string | null;
  requires_bvlos: boolean;
}

export interface MissionAccessContext {
  missionId: string;
  organisationId: string | null;
  pilotId: string | null;
  platformId: string | null;
  operationType: string | null;
  requiresBvlos: boolean;
}

export class MissionAccessRepository {
  async getMissionContext(
    tx: PoolClient,
    missionId: string,
  ): Promise<MissionAccessContext | null> {
    const result = await tx.query<MissionAccessRow>(
      `
      select
        id,
        organisation_id,
        pilot_id,
        platform_id,
        operation_type,
        requires_bvlos
      from missions
      where id = $1
      `,
      [missionId],
    );

    if (!result.rows[0]) {
      return null;
    }

    return {
      missionId: result.rows[0].id,
      organisationId: result.rows[0].organisation_id,
      pilotId: result.rows[0].pilot_id,
      platformId: result.rows[0].platform_id,
      operationType: result.rows[0].operation_type,
      requiresBvlos: result.rows[0].requires_bvlos,
    };
  }
}
