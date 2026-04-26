import type { PoolClient, QueryResultRow } from "pg";
import type { AccountableManagerMissionSummary } from "./accountable-manager-dashboard.types";

interface MissionSummaryRow extends QueryResultRow {
  id: string;
  mission_plan_id: string | null;
  status: string;
  operation_type: string | null;
  requires_bvlos: boolean;
  updated_at: Date;
  platform_name: string | null;
  pilot_name: string | null;
}

export class AccountableManagerDashboardRepository {
  async listMissionSummariesByOrganisation(
    tx: PoolClient,
    organisationId: string,
    limit: number,
  ): Promise<AccountableManagerMissionSummary[]> {
    const result = await tx.query<MissionSummaryRow>(
      `
      select
        missions.id,
        missions.mission_plan_id,
        missions.status,
        missions.operation_type,
        missions.requires_bvlos,
        coalesce(
          (
            select max(mission_events.event_ts)
            from mission_events
            where mission_events.mission_id = missions.id
          ),
          now()
        ) as updated_at,
        platforms.name as platform_name,
        pilots.display_name as pilot_name
      from missions
      left join platforms on platforms.id = missions.platform_id
      left join pilots on pilots.id = missions.pilot_id
      where missions.organisation_id = $1
      order by updated_at desc, missions.id desc
      limit $2
      `,
      [organisationId, limit],
    );

    return result.rows.map((row) => ({
      missionId: row.id,
      missionPlanId: row.mission_plan_id,
      status: row.status,
      operationType: row.operation_type,
      requiresBvlos: row.requires_bvlos,
      platformName: row.platform_name,
      pilotName: row.pilot_name,
      updatedAt: row.updated_at.toISOString(),
    }));
  }
}
