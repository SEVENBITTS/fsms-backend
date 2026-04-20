import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { MissionPlanningReview } from "./mission-planning.types";

interface MissionPlanningDraftRow extends QueryResultRow {
  id: string;
  status: "draft";
  mission_plan_id: string | null;
  platform_id: string | null;
  pilot_id: string | null;
  risk_input_present: boolean;
  airspace_input_present: boolean;
}

interface MissionPlanningWorkspaceRow extends QueryResultRow {
  id: string;
  status: string;
  mission_plan_id: string | null;
  platform_id: string | null;
  pilot_id: string | null;
  last_event_sequence_no: number;
  risk_input_present: boolean;
  airspace_input_present: boolean;
}

interface MissionPlanningApprovalHandoffTraceRow extends QueryResultRow {
  id: string;
  mission_id: string;
  audit_evidence_snapshot_id: string;
  mission_decision_evidence_link_id: string;
  planning_review: MissionPlanningReview;
  created_by: string | null;
  created_at: string;
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

  async updateDraftMissionPlaceholders(
    tx: PoolClient,
    missionId: string,
    input: {
      missionPlanId?: string | null;
      platformId?: string | null;
      pilotId?: string | null;
    },
  ): Promise<boolean> {
    const setClauses: string[] = [];
    const values: Array<string | null> = [missionId];

    if (Object.prototype.hasOwnProperty.call(input, "missionPlanId")) {
      values.push(input.missionPlanId ?? null);
      setClauses.push(`mission_plan_id = $${values.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(input, "platformId")) {
      values.push(input.platformId ?? null);
      setClauses.push(`platform_id = $${values.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(input, "pilotId")) {
      values.push(input.pilotId ?? null);
      setClauses.push(`pilot_id = $${values.length}`);
    }

    if (setClauses.length === 0) {
      return true;
    }

    const result = await tx.query(
      `
      update missions
      set ${setClauses.join(", ")}
      where id = $1
        and status = 'draft'
      `,
      values,
    );

    return result.rowCount === 1;
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

  async getMissionWorkspaceMission(
    tx: PoolClient,
    missionId: string,
  ): Promise<MissionPlanningWorkspaceRow | null> {
    const result = await tx.query<MissionPlanningWorkspaceRow>(
      `
      select
        missions.id,
        missions.status,
        missions.mission_plan_id,
        missions.platform_id,
        missions.pilot_id,
        missions.last_event_sequence_no,
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
      `,
      [missionId],
    );

    return result.rows[0] ?? null;
  }

  async insertApprovalHandoffTrace(
    tx: PoolClient,
    input: {
      missionId: string;
      snapshotId: string;
      approvalEvidenceLinkId: string;
      review: MissionPlanningReview;
      createdBy: string | null;
    },
  ): Promise<string> {
    const result = await tx.query<{ id: string }>(
      `
      insert into mission_planning_approval_handoffs (
        id,
        mission_id,
        audit_evidence_snapshot_id,
        mission_decision_evidence_link_id,
        planning_review,
        created_by
      )
      values ($1, $2, $3, $4, $5::jsonb, $6)
      returning id
      `,
      [
        randomUUID(),
        input.missionId,
        input.snapshotId,
        input.approvalEvidenceLinkId,
        JSON.stringify(input.review),
        input.createdBy,
      ],
    );

    return result.rows[0].id;
  }

  async getLatestApprovalHandoffTrace(
    tx: PoolClient,
    missionId: string,
  ): Promise<MissionPlanningApprovalHandoffTraceRow | null> {
    const result = await tx.query<MissionPlanningApprovalHandoffTraceRow>(
      `
      select
        id,
        mission_id,
        audit_evidence_snapshot_id,
        mission_decision_evidence_link_id,
        planning_review,
        created_by,
        created_at
      from mission_planning_approval_handoffs
      where mission_id = $1
      order by created_at desc, id desc
      limit 1
      `,
      [missionId],
    );

    return result.rows[0] ?? null;
  }
}
