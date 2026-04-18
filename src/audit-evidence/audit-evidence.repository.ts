import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { MissionReadinessCheck } from "../missions/mission-readiness.types";
import type {
  AuditEvidenceSnapshot,
  MissionDecisionEvidenceLink,
  MissionLifecycleEvidenceEvent,
  PlanningApprovalHandoffEvidence,
  PostOperationCompletionSnapshot,
  PostOperationEvidenceSnapshot,
} from "./audit-evidence.types";

interface AuditEvidenceSnapshotRow extends QueryResultRow {
  id: string;
  mission_id: string;
  evidence_type: AuditEvidenceSnapshot["evidenceType"];
  readiness_result: AuditEvidenceSnapshot["readinessResult"];
  gate_result: AuditEvidenceSnapshot["gateResult"];
  blocks_approval: boolean;
  blocks_dispatch: boolean;
  requires_review: boolean;
  readiness_snapshot: MissionReadinessCheck;
  created_by: string | null;
  created_at: Date;
}

interface CreateAuditEvidenceSnapshotRow {
  missionId: string;
  readinessSnapshot: MissionReadinessCheck;
  createdBy: string | null;
}

interface MissionDecisionEvidenceLinkRow extends QueryResultRow {
  id: string;
  mission_id: string;
  audit_evidence_snapshot_id: string;
  decision_type: MissionDecisionEvidenceLink["decisionType"];
  created_by: string | null;
  created_at: Date;
}

interface CreateMissionDecisionEvidenceLinkRow {
  missionId: string;
  snapshotId: string;
  decisionType: MissionDecisionEvidenceLink["decisionType"];
  createdBy: string | null;
}

interface MissionAuditStateRow extends QueryResultRow {
  id: string;
  status: string;
  mission_plan_id: string | null;
}

interface MissionLifecycleEvidenceEventRow extends QueryResultRow {
  id: string;
  sequence_no: number;
  event_type: string;
  event_ts: Date;
  recorded_at: Date;
  actor_type: string;
  actor_id: string | null;
  from_state: string | null;
  to_state: string | null;
  summary: string;
  details: Record<string, unknown>;
}

interface PlanningApprovalHandoffEvidenceRow extends QueryResultRow {
  id: string;
  mission_id: string;
  audit_evidence_snapshot_id: string;
  mission_decision_evidence_link_id: string;
  planning_review: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
}

interface PostOperationEvidenceSnapshotRow extends QueryResultRow {
  id: string;
  mission_id: string;
  evidence_type: PostOperationEvidenceSnapshot["evidenceType"];
  lifecycle_state: string;
  completion_snapshot: PostOperationCompletionSnapshot;
  created_by: string | null;
  created_at: Date;
}

interface CreatePostOperationEvidenceSnapshotRow {
  missionId: string;
  lifecycleState: string;
  completionSnapshot: PostOperationCompletionSnapshot;
  createdBy: string | null;
}

const toAuditEvidenceSnapshot = (
  row: AuditEvidenceSnapshotRow,
): AuditEvidenceSnapshot => ({
  id: row.id,
  missionId: row.mission_id,
  evidenceType: row.evidence_type,
  readinessResult: row.readiness_result,
  gateResult: row.gate_result,
  blocksApproval: row.blocks_approval,
  blocksDispatch: row.blocks_dispatch,
  requiresReview: row.requires_review,
  readinessSnapshot: row.readiness_snapshot,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString(),
});

const toMissionDecisionEvidenceLink = (
  row: MissionDecisionEvidenceLinkRow,
): MissionDecisionEvidenceLink => ({
  id: row.id,
  missionId: row.mission_id,
  auditEvidenceSnapshotId: row.audit_evidence_snapshot_id,
  decisionType: row.decision_type,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString(),
});

const toMissionLifecycleEvidenceEvent = (
  row: MissionLifecycleEvidenceEventRow,
): MissionLifecycleEvidenceEvent => ({
  id: Number(row.id),
  sequence: row.sequence_no,
  type: row.event_type,
  time: row.event_ts.toISOString(),
  recordedAt: row.recorded_at.toISOString(),
  actorType: row.actor_type,
  actorId: row.actor_id,
  fromState: row.from_state,
  toState: row.to_state,
  summary: row.summary,
  details: row.details,
});

const toPlanningApprovalHandoffEvidence = (
  row: PlanningApprovalHandoffEvidenceRow,
): PlanningApprovalHandoffEvidence => ({
  id: row.id,
  missionId: row.mission_id,
  auditEvidenceSnapshotId: row.audit_evidence_snapshot_id,
  missionDecisionEvidenceLinkId: row.mission_decision_evidence_link_id,
  planningReview: row.planning_review,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString(),
});

const toPostOperationEvidenceSnapshot = (
  row: PostOperationEvidenceSnapshotRow,
): PostOperationEvidenceSnapshot => ({
  id: row.id,
  missionId: row.mission_id,
  evidenceType: row.evidence_type,
  lifecycleState: row.lifecycle_state,
  completionSnapshot: row.completion_snapshot,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString(),
});

export class AuditEvidenceRepository {
  async missionExists(tx: PoolClient, missionId: string): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from missions
      where id = $1
      `,
      [missionId],
    );

    return result.rowCount === 1;
  }

  async getMissionAuditState(
    tx: PoolClient,
    missionId: string,
  ): Promise<MissionAuditStateRow | null> {
    const result = await tx.query<MissionAuditStateRow>(
      `
      select id, status, mission_plan_id
      from missions
      where id = $1
      `,
      [missionId],
    );

    return result.rows[0] ?? null;
  }

  async insertReadinessSnapshot(
    tx: PoolClient,
    input: CreateAuditEvidenceSnapshotRow,
  ): Promise<AuditEvidenceSnapshot> {
    const result = await tx.query<AuditEvidenceSnapshotRow>(
      `
      insert into audit_evidence_snapshots (
        id,
        mission_id,
        evidence_type,
        readiness_result,
        gate_result,
        blocks_approval,
        blocks_dispatch,
        requires_review,
        readiness_snapshot,
        created_by
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
      returning *
      `,
      [
        randomUUID(),
        input.missionId,
        "mission_readiness_gate",
        input.readinessSnapshot.result,
        input.readinessSnapshot.gate.result,
        input.readinessSnapshot.gate.blocksApproval,
        input.readinessSnapshot.gate.blocksDispatch,
        input.readinessSnapshot.gate.requiresReview,
        JSON.stringify(input.readinessSnapshot),
        input.createdBy,
      ],
    );

    return toAuditEvidenceSnapshot(result.rows[0]);
  }

  async listReadinessSnapshots(
    tx: PoolClient,
    missionId: string,
  ): Promise<AuditEvidenceSnapshot[]> {
    const result = await tx.query<AuditEvidenceSnapshotRow>(
      `
      select *
      from audit_evidence_snapshots
      where mission_id = $1
        and evidence_type = 'mission_readiness_gate'
      order by created_at desc, id desc
      `,
      [missionId],
    );

    return result.rows.map(toAuditEvidenceSnapshot);
  }

  async snapshotExistsForMission(
    tx: PoolClient,
    missionId: string,
    snapshotId: string,
  ): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from audit_evidence_snapshots
      where mission_id = $1
        and id = $2
      `,
      [missionId, snapshotId],
    );

    return result.rowCount === 1;
  }

  async insertDecisionEvidenceLink(
    tx: PoolClient,
    input: CreateMissionDecisionEvidenceLinkRow,
  ): Promise<MissionDecisionEvidenceLink> {
    const result = await tx.query<MissionDecisionEvidenceLinkRow>(
      `
      insert into mission_decision_evidence_links (
        id,
        mission_id,
        audit_evidence_snapshot_id,
        decision_type,
        created_by
      )
      values ($1, $2, $3, $4, $5)
      returning *
      `,
      [
        randomUUID(),
        input.missionId,
        input.snapshotId,
        input.decisionType,
        input.createdBy,
      ],
    );

    return toMissionDecisionEvidenceLink(result.rows[0]);
  }

  async listDecisionEvidenceLinks(
    tx: PoolClient,
    missionId: string,
  ): Promise<MissionDecisionEvidenceLink[]> {
    const result = await tx.query<MissionDecisionEvidenceLinkRow>(
      `
      select *
      from mission_decision_evidence_links
      where mission_id = $1
      order by created_at desc, id desc
      `,
      [missionId],
    );

    return result.rows.map(toMissionDecisionEvidenceLink);
  }

  async getDecisionEvidenceLinkForMission(
    tx: PoolClient,
    missionId: string,
    linkId: string,
  ): Promise<MissionDecisionEvidenceLink | null> {
    const result = await tx.query<MissionDecisionEvidenceLinkRow>(
      `
      select *
      from mission_decision_evidence_links
      where mission_id = $1
        and id = $2
      limit 1
      `,
      [missionId, linkId],
    );

    return result.rows[0] ? toMissionDecisionEvidenceLink(result.rows[0]) : null;
  }

  async getDecisionEvidenceLinkById(
    tx: PoolClient,
    missionId: string,
    linkId: string | null,
  ): Promise<MissionDecisionEvidenceLink | null> {
    if (!linkId) {
      return null;
    }

    return this.getDecisionEvidenceLinkForMission(tx, missionId, linkId);
  }

  async getLifecycleEvidenceEvents(
    tx: PoolClient,
    missionId: string,
  ): Promise<MissionLifecycleEvidenceEvent[]> {
    const result = await tx.query<MissionLifecycleEvidenceEventRow>(
      `
      select
        id,
        sequence_no,
        event_type,
        event_ts,
        recorded_at,
        actor_type,
        actor_id,
        from_state,
        to_state,
        summary,
        details
      from mission_events
      where mission_id = $1
        and event_type in (
          'mission.approved',
          'mission.launched',
          'mission.completed'
        )
      order by sequence_no asc, id asc
      `,
      [missionId],
    );

    return result.rows.map(toMissionLifecycleEvidenceEvent);
  }

  async getPlanningApprovalHandoffForDecisionLink(
    tx: PoolClient,
    missionId: string,
    decisionEvidenceLinkId: string | null,
  ): Promise<PlanningApprovalHandoffEvidence | null> {
    if (!decisionEvidenceLinkId) {
      return null;
    }

    const result = await tx.query<PlanningApprovalHandoffEvidenceRow>(
      `
      select *
      from mission_planning_approval_handoffs
      where mission_id = $1
        and mission_decision_evidence_link_id = $2
      limit 1
      `,
      [missionId, decisionEvidenceLinkId],
    );

    return result.rows[0]
      ? toPlanningApprovalHandoffEvidence(result.rows[0])
      : null;
  }

  async insertPostOperationEvidenceSnapshot(
    tx: PoolClient,
    input: CreatePostOperationEvidenceSnapshotRow,
  ): Promise<PostOperationEvidenceSnapshot> {
    const result = await tx.query<PostOperationEvidenceSnapshotRow>(
      `
      insert into post_operation_evidence_snapshots (
        id,
        mission_id,
        evidence_type,
        lifecycle_state,
        completion_snapshot,
        created_by
      )
      values ($1, $2, $3, $4, $5::jsonb, $6)
      returning *
      `,
      [
        randomUUID(),
        input.missionId,
        "post_operation_completion",
        input.lifecycleState,
        JSON.stringify(input.completionSnapshot),
        input.createdBy,
      ],
    );

    return toPostOperationEvidenceSnapshot(result.rows[0]);
  }

  async listPostOperationEvidenceSnapshots(
    tx: PoolClient,
    missionId: string,
  ): Promise<PostOperationEvidenceSnapshot[]> {
    const result = await tx.query<PostOperationEvidenceSnapshotRow>(
      `
      select *
      from post_operation_evidence_snapshots
      where mission_id = $1
        and evidence_type = 'post_operation_completion'
      order by created_at desc, id desc
      `,
      [missionId],
    );

    return result.rows.map(toPostOperationEvidenceSnapshot);
  }

  async decisionEvidenceLinkReferencesReadinessSnapshot(
    tx: PoolClient,
    missionId: string,
    linkId: string,
  ): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from mission_decision_evidence_links links
      inner join audit_evidence_snapshots snapshots
        on snapshots.mission_id = links.mission_id
       and snapshots.id = links.audit_evidence_snapshot_id
      where links.mission_id = $1
        and links.id = $2
        and snapshots.evidence_type = 'mission_readiness_gate'
      `,
      [missionId, linkId],
    );

    return result.rowCount === 1;
  }

  async decisionEvidenceLinkReferencesPlanningApprovalHandoff(
    tx: PoolClient,
    missionId: string,
    linkId: string,
  ): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from mission_planning_approval_handoffs handoffs
      inner join mission_decision_evidence_links links
        on links.id = handoffs.mission_decision_evidence_link_id
       and links.mission_id = handoffs.mission_id
      inner join audit_evidence_snapshots snapshots
        on snapshots.mission_id = handoffs.mission_id
       and snapshots.id = handoffs.audit_evidence_snapshot_id
      where handoffs.mission_id = $1
        and handoffs.mission_decision_evidence_link_id = $2
        and links.decision_type = 'approval'
        and snapshots.evidence_type = 'mission_readiness_gate'
        and coalesce((handoffs.planning_review ->> 'readyForApproval')::boolean, false) = true
      `,
      [missionId, linkId],
    );

    return result.rowCount === 1;
  }

  async missionHasPlanningBackedApprovalEvent(
    tx: PoolClient,
    missionId: string,
  ): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from mission_events events
      inner join mission_planning_approval_handoffs handoffs
        on handoffs.mission_id = events.mission_id
       and handoffs.mission_decision_evidence_link_id::text =
        events.details ->> 'decision_evidence_link_id'
      inner join mission_decision_evidence_links links
        on links.id = handoffs.mission_decision_evidence_link_id
       and links.mission_id = handoffs.mission_id
      where events.mission_id = $1
        and events.event_type = 'mission.approved'
        and links.decision_type = 'approval'
        and coalesce((handoffs.planning_review ->> 'readyForApproval')::boolean, false) = true
      limit 1
      `,
      [missionId],
    );

    return result.rowCount === 1;
  }
}
