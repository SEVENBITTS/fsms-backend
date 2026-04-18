import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { MissionReadinessCheck } from "../missions/mission-readiness.types";
import type {
  AuditEvidenceSnapshot,
  MissionDecisionEvidenceLink,
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
}
