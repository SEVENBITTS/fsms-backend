import type { PoolClient, QueryResultRow } from "pg";
import type { MissionOverridePressureSummary } from "./risk-map.types";

interface MissionContextRow extends QueryResultRow {
  id: string;
  organisation_id: string | null;
  platform_id: string | null;
  pilot_id: string | null;
}

interface OverridePressureRow extends QueryResultRow {
  override_event_count: string | number;
  latest_override_at: Date | null;
  review_required_snapshot_count: string | number;
  latest_snapshot_requires_review: boolean;
}

export class RiskMapRepository {
  async getMissionContext(
    tx: PoolClient,
    missionId: string,
  ): Promise<{
    missionId: string;
    organisationId: string | null;
    platformId: string | null;
    pilotId: string | null;
  } | null> {
    const result = await tx.query<MissionContextRow>(
      `
      select
        id,
        organisation_id,
        platform_id,
        pilot_id
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
      platformId: result.rows[0].platform_id,
      pilotId: result.rows[0].pilot_id,
    };
  }

  async getOverridePressureSummary(
    tx: PoolClient,
    missionId: string,
  ): Promise<MissionOverridePressureSummary> {
    const result = await tx.query<OverridePressureRow>(
      `
      select
        (
          select count(*)::int
          from mission_events
          where mission_id = $1
            and event_type = 'override.applied'
        ) as override_event_count,
        (
          select max(event_ts)
          from mission_events
          where mission_id = $1
            and event_type = 'override.applied'
        ) as latest_override_at,
        (
          select count(*)::int
          from audit_evidence_snapshots
          where mission_id = $1
            and evidence_type = 'mission_readiness_gate'
            and requires_review = true
        ) as review_required_snapshot_count,
        coalesce(
          (
            select requires_review
            from audit_evidence_snapshots
            where mission_id = $1
              and evidence_type = 'mission_readiness_gate'
            order by created_at desc, id desc
            limit 1
          ),
          false
        ) as latest_snapshot_requires_review
      `,
      [missionId],
    );

    return {
      overrideEventCount: Number(result.rows[0].override_event_count),
      latestOverrideAt: result.rows[0].latest_override_at
        ? result.rows[0].latest_override_at.toISOString()
        : null,
      reviewRequiredSnapshotCount: Number(
        result.rows[0].review_required_snapshot_count,
      ),
      latestSnapshotRequiresReview:
        result.rows[0].latest_snapshot_requires_review,
    };
  }
}
