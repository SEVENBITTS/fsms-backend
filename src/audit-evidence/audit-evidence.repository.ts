import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  AuditEvidenceSnapshot,
  AuditEvidenceReadinessSnapshot,
  AuditReportSmsControlMapping,
  ConflictGuidanceAcknowledgement,
  LiveOpsMapViewStateSnapshot,
  MissionDecisionEvidenceLink,
  MissionLifecycleEvidenceEvent,
  PlanningApprovalHandoffEvidence,
  PostOperationAuditSignoff,
  PostOperationCompletionSnapshot,
  PostOperationEvidenceSnapshot,
  RegulatoryAmendmentAlertAuditRecord,
  SafetyActionClosureDecisionExportContext,
  SafetyActionClosureEvidenceExportContext,
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
  readiness_snapshot: AuditEvidenceReadinessSnapshot;
  created_by: string | null;
  created_at: Date;
}

interface CreateAuditEvidenceSnapshotRow {
  missionId: string;
  readinessSnapshot: AuditEvidenceReadinessSnapshot;
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

interface LiveOpsMapViewStateSnapshotRow extends QueryResultRow {
  id: string;
  mission_id: string;
  evidence_type: LiveOpsMapViewStateSnapshot["evidenceType"];
  replay_cursor: string;
  replay_timestamp: Date | null;
  area_freshness_filter: LiveOpsMapViewStateSnapshot["areaFreshnessFilter"];
  visible_area_overlay_count: number;
  total_area_overlay_count: number;
  degraded_area_overlay_count: number;
  open_alert_count: number;
  active_conflict_count: number;
  area_refresh_run_count: number;
  view_state_url: string | null;
  snapshot_metadata: Record<string, unknown>;
  capture_scope: LiveOpsMapViewStateSnapshot["captureScope"];
  pilot_instruction_status: LiveOpsMapViewStateSnapshot["pilotInstructionStatus"];
  created_by: string | null;
  created_at: Date;
}

interface CreateLiveOpsMapViewStateSnapshotRow {
  missionId: string;
  replayCursor: string;
  replayTimestamp: string | null;
  areaFreshnessFilter: LiveOpsMapViewStateSnapshot["areaFreshnessFilter"];
  visibleAreaOverlayCount: number;
  totalAreaOverlayCount: number;
  degradedAreaOverlayCount: number;
  openAlertCount: number;
  activeConflictCount: number;
  areaRefreshRunCount: number;
  viewStateUrl: string | null;
  snapshotMetadata: Record<string, unknown>;
  createdBy: string | null;
}

interface ConflictGuidanceAcknowledgementRow extends QueryResultRow {
  id: string;
  mission_id: string;
  conflict_id: string;
  overlay_id: string;
  guidance_action_code: ConflictGuidanceAcknowledgement["guidanceActionCode"];
  evidence_action: ConflictGuidanceAcknowledgement["evidenceAction"];
  acknowledgement_role: ConflictGuidanceAcknowledgement["acknowledgementRole"];
  acknowledged_by: string;
  acknowledgement_note: string | null;
  guidance_summary: string;
  pilot_instruction_status: ConflictGuidanceAcknowledgement["pilotInstructionStatus"];
  created_at: Date;
}

interface CreateConflictGuidanceAcknowledgementRow {
  missionId: string;
  conflictId: string;
  overlayId: string;
  guidanceActionCode: ConflictGuidanceAcknowledgement["guidanceActionCode"];
  evidenceAction: ConflictGuidanceAcknowledgement["evidenceAction"];
  acknowledgementRole: ConflictGuidanceAcknowledgement["acknowledgementRole"];
  acknowledgedBy: string;
  acknowledgementNote: string | null;
  guidanceSummary: string;
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

interface PostOperationAuditSignoffRow extends QueryResultRow {
  id: string;
  mission_id: string;
  post_operation_evidence_snapshot_id: string;
  accountable_manager_name: string;
  accountable_manager_role: string;
  review_decision: PostOperationAuditSignoff["reviewDecision"];
  signed_at: Date;
  signature_reference: string | null;
  created_by: string | null;
  created_at: Date;
}

interface CreatePostOperationAuditSignoffRow {
  missionId: string;
  postOperationEvidenceSnapshotId: string;
  accountableManagerName: string;
  accountableManagerRole: string;
  reviewDecision: PostOperationAuditSignoff["reviewDecision"];
  signedAt: string;
  signatureReference: string | null;
  createdBy: string | null;
}

interface AuditReportSmsControlMappingRow extends QueryResultRow {
  code: string;
  title: string;
  control_area: string;
  sms_elements: string[] | null;
}

interface SafetyActionClosureEvidenceExportRow extends QueryResultRow {
  safety_event_id: string;
  event_type: string;
  event_severity: string;
  event_status: string;
  event_summary: string;
  event_occurred_at: Date;
  sop_reference: string | null;
  safety_event_meeting_trigger_id: string;
  air_safety_meeting_id: string;
  safety_event_agenda_link_id: string;
  agenda_item: string;
  safety_action_proposal_id: string;
  proposal_type: string;
  proposal_status: string;
  proposal_summary: string;
  proposal_owner: string | null;
  proposal_due_at: Date | null;
  decisions: SafetyActionClosureDecisionExportContext[] | null;
  implementation_evidence_id: string;
  evidence_category: string;
  implementation_summary: string;
  evidence_reference: string | null;
  completed_by: string | null;
  completed_at: Date;
  reviewed_by: string | null;
  review_notes: string | null;
  evidence_created_at: Date;
}

interface RegulatoryAmendmentAlertAuditRow extends QueryResultRow {
  id: string;
  status: RegulatoryAmendmentAlertAuditRecord["status"];
  severity: RegulatoryAmendmentAlertAuditRecord["severity"];
  message: string;
  metadata: Record<string, unknown>;
  triggered_at: Date;
  created_at: Date;
  acknowledged_at: Date | null;
  resolved_at: Date | null;
}

const toNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0,
        )
        .map((entry) => entry.trim())
    : [];

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

const toLiveOpsMapViewStateSnapshot = (
  row: LiveOpsMapViewStateSnapshotRow,
): LiveOpsMapViewStateSnapshot => ({
  id: row.id,
  missionId: row.mission_id,
  evidenceType: row.evidence_type,
  replayCursor: row.replay_cursor,
  replayTimestamp: row.replay_timestamp?.toISOString() ?? null,
  areaFreshnessFilter: row.area_freshness_filter,
  visibleAreaOverlayCount: row.visible_area_overlay_count,
  totalAreaOverlayCount: row.total_area_overlay_count,
  degradedAreaOverlayCount: row.degraded_area_overlay_count,
  openAlertCount: row.open_alert_count,
  activeConflictCount: row.active_conflict_count,
  areaRefreshRunCount: row.area_refresh_run_count,
  viewStateUrl: row.view_state_url,
  snapshotMetadata: row.snapshot_metadata,
  captureScope: row.capture_scope,
  pilotInstructionStatus: row.pilot_instruction_status,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString(),
});

const toConflictGuidanceAcknowledgement = (
  row: ConflictGuidanceAcknowledgementRow,
): ConflictGuidanceAcknowledgement => ({
  id: row.id,
  missionId: row.mission_id,
  conflictId: row.conflict_id,
  overlayId: row.overlay_id,
  guidanceActionCode: row.guidance_action_code,
  evidenceAction: row.evidence_action,
  acknowledgementRole: row.acknowledgement_role,
  acknowledgedBy: row.acknowledged_by,
  acknowledgementNote: row.acknowledgement_note,
  guidanceSummary: row.guidance_summary,
  pilotInstructionStatus: row.pilot_instruction_status,
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

const toPostOperationAuditSignoff = (
  row: PostOperationAuditSignoffRow,
): PostOperationAuditSignoff => ({
  id: row.id,
  missionId: row.mission_id,
  postOperationEvidenceSnapshotId: row.post_operation_evidence_snapshot_id,
  accountableManagerName: row.accountable_manager_name,
  accountableManagerRole: row.accountable_manager_role,
  reviewDecision: row.review_decision,
  signedAt: row.signed_at.toISOString(),
  signatureReference: row.signature_reference,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString(),
});

const toAuditReportSmsControlMapping = (
  row: AuditReportSmsControlMappingRow,
): AuditReportSmsControlMapping => ({
  code: row.code,
  title: row.title,
  controlArea: row.control_area,
  smsElements: row.sms_elements ?? [],
});

const toSafetyActionClosureEvidenceExportContext = (
  row: SafetyActionClosureEvidenceExportRow,
): SafetyActionClosureEvidenceExportContext => ({
  safetyEventId: row.safety_event_id,
  eventType: row.event_type,
  eventSeverity: row.event_severity,
  eventStatus: row.event_status,
  eventSummary: row.event_summary,
  eventOccurredAt: row.event_occurred_at.toISOString(),
  sopReference: row.sop_reference,
  safetyEventMeetingTriggerId: row.safety_event_meeting_trigger_id,
  airSafetyMeetingId: row.air_safety_meeting_id,
  safetyEventAgendaLinkId: row.safety_event_agenda_link_id,
  agendaItem: row.agenda_item,
  safetyActionProposalId: row.safety_action_proposal_id,
  proposalType: row.proposal_type,
  proposalStatus: row.proposal_status,
  proposalSummary: row.proposal_summary,
  proposalOwner: row.proposal_owner,
  proposalDueAt: row.proposal_due_at?.toISOString() ?? null,
  decisions: row.decisions ?? [],
  implementationEvidenceId: row.implementation_evidence_id,
  evidenceCategory: row.evidence_category,
  implementationSummary: row.implementation_summary,
  evidenceReference: row.evidence_reference,
  completedBy: row.completed_by,
  completedAt: row.completed_at.toISOString(),
  reviewedBy: row.reviewed_by,
  reviewNotes: row.review_notes,
  evidenceCreatedAt: row.evidence_created_at.toISOString(),
});

const toRegulatoryAmendmentAlertAuditRecord = (
  row: RegulatoryAmendmentAlertAuditRow,
): RegulatoryAmendmentAlertAuditRecord => ({
  id: row.id,
  status: row.status,
  severity: row.severity,
  message: row.message,
  sourceDocument: toNullableString(row.metadata.sourceDocument),
  previousVersion: toNullableString(row.metadata.previousVersion),
  currentVersion: toNullableString(row.metadata.currentVersion),
  publishedAt: toNullableString(row.metadata.publishedAt),
  effectiveFrom: toNullableString(row.metadata.effectiveFrom),
  amendmentSummary: toNullableString(row.metadata.amendmentSummary),
  changeImpact: toNullableString(row.metadata.changeImpact),
  affectedRequirementRefs: toStringArray(row.metadata.affectedRequirementRefs),
  reviewAction: toNullableString(row.metadata.reviewAction),
  triggeredAt: row.triggered_at.toISOString(),
  acknowledgedAt: row.acknowledged_at?.toISOString() ?? null,
  resolvedAt: row.resolved_at?.toISOString() ?? null,
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

  async insertLiveOpsMapViewStateSnapshot(
    tx: PoolClient,
    input: CreateLiveOpsMapViewStateSnapshotRow,
  ): Promise<LiveOpsMapViewStateSnapshot> {
    const result = await tx.query<LiveOpsMapViewStateSnapshotRow>(
      `
      insert into live_ops_map_view_state_snapshots (
        id,
        mission_id,
        evidence_type,
        replay_cursor,
        replay_timestamp,
        area_freshness_filter,
        visible_area_overlay_count,
        total_area_overlay_count,
        degraded_area_overlay_count,
        open_alert_count,
        active_conflict_count,
        area_refresh_run_count,
        view_state_url,
        snapshot_metadata,
        capture_scope,
        pilot_instruction_status,
        created_by
      )
      values (
        $1,
        $2,
        'live_ops_map_view_state',
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13::jsonb,
        'metadata_only',
        'not_a_pilot_command',
        $14
      )
      returning *
      `,
      [
        randomUUID(),
        input.missionId,
        input.replayCursor,
        input.replayTimestamp,
        input.areaFreshnessFilter,
        input.visibleAreaOverlayCount,
        input.totalAreaOverlayCount,
        input.degradedAreaOverlayCount,
        input.openAlertCount,
        input.activeConflictCount,
        input.areaRefreshRunCount,
        input.viewStateUrl,
        JSON.stringify(input.snapshotMetadata),
        input.createdBy,
      ],
    );

    return toLiveOpsMapViewStateSnapshot(result.rows[0]);
  }

  async listLiveOpsMapViewStateSnapshots(
    tx: PoolClient,
    missionId: string,
  ): Promise<LiveOpsMapViewStateSnapshot[]> {
    const result = await tx.query<LiveOpsMapViewStateSnapshotRow>(
      `
      select *
      from live_ops_map_view_state_snapshots
      where mission_id = $1
        and evidence_type = 'live_ops_map_view_state'
      order by created_at desc, id desc
      `,
      [missionId],
    );

    return result.rows.map(toLiveOpsMapViewStateSnapshot);
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

  async overlayExistsForMission(
    tx: PoolClient,
    missionId: string,
    overlayId: string,
  ): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from mission_external_overlays
      where mission_id = $1
        and id = $2
      `,
      [missionId, overlayId],
    );

    return result.rowCount === 1;
  }

  async insertConflictGuidanceAcknowledgement(
    tx: PoolClient,
    input: CreateConflictGuidanceAcknowledgementRow,
  ): Promise<ConflictGuidanceAcknowledgement> {
    const result = await tx.query<ConflictGuidanceAcknowledgementRow>(
      `
      insert into conflict_guidance_acknowledgements (
        id,
        mission_id,
        conflict_id,
        overlay_id,
        guidance_action_code,
        evidence_action,
        acknowledgement_role,
        acknowledged_by,
        acknowledgement_note,
        guidance_summary,
        pilot_instruction_status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'not_a_pilot_command')
      returning *
      `,
      [
        randomUUID(),
        input.missionId,
        input.conflictId,
        input.overlayId,
        input.guidanceActionCode,
        input.evidenceAction,
        input.acknowledgementRole,
        input.acknowledgedBy,
        input.acknowledgementNote,
        input.guidanceSummary,
      ],
    );

    return toConflictGuidanceAcknowledgement(result.rows[0]);
  }

  async listConflictGuidanceAcknowledgements(
    tx: PoolClient,
    missionId: string,
  ): Promise<ConflictGuidanceAcknowledgement[]> {
    const result = await tx.query<ConflictGuidanceAcknowledgementRow>(
      `
      select *
      from conflict_guidance_acknowledgements
      where mission_id = $1
      order by created_at desc, id desc
      `,
      [missionId],
    );

    return result.rows.map(toConflictGuidanceAcknowledgement);
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

  async getPostOperationEvidenceSnapshotForMission(
    tx: PoolClient,
    missionId: string,
    snapshotId: string,
  ): Promise<PostOperationEvidenceSnapshot | null> {
    const result = await tx.query<PostOperationEvidenceSnapshotRow>(
      `
      select *
      from post_operation_evidence_snapshots
      where mission_id = $1
        and id = $2
        and evidence_type = 'post_operation_completion'
      limit 1
      `,
      [missionId, snapshotId],
    );

    return result.rows[0]
      ? toPostOperationEvidenceSnapshot(result.rows[0])
      : null;
  }

  async postOperationAuditSignoffExistsForSnapshot(
    tx: PoolClient,
    snapshotId: string,
  ): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from post_operation_audit_signoffs
      where post_operation_evidence_snapshot_id = $1
      `,
      [snapshotId],
    );

    return result.rowCount === 1;
  }

  async insertPostOperationAuditSignoff(
    tx: PoolClient,
    input: CreatePostOperationAuditSignoffRow,
  ): Promise<PostOperationAuditSignoff> {
    const result = await tx.query<PostOperationAuditSignoffRow>(
      `
      insert into post_operation_audit_signoffs (
        id,
        mission_id,
        post_operation_evidence_snapshot_id,
        accountable_manager_name,
        accountable_manager_role,
        review_decision,
        signed_at,
        signature_reference,
        created_by
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
      `,
      [
        randomUUID(),
        input.missionId,
        input.postOperationEvidenceSnapshotId,
        input.accountableManagerName,
        input.accountableManagerRole,
        input.reviewDecision,
        input.signedAt,
        input.signatureReference,
        input.createdBy,
      ],
    );

    return toPostOperationAuditSignoff(result.rows[0]);
  }

  async getPostOperationAuditSignoffForSnapshot(
    tx: PoolClient,
    missionId: string,
    snapshotId: string,
  ): Promise<PostOperationAuditSignoff | null> {
    const result = await tx.query<PostOperationAuditSignoffRow>(
      `
      select *
      from post_operation_audit_signoffs
      where mission_id = $1
        and post_operation_evidence_snapshot_id = $2
      limit 1
      `,
      [missionId, snapshotId],
    );

    return result.rows[0]
      ? toPostOperationAuditSignoff(result.rows[0])
      : null;
  }

  async listSmsControlMappingsForAuditReport(
    tx: PoolClient,
  ): Promise<AuditReportSmsControlMapping[]> {
    const result = await tx.query<AuditReportSmsControlMappingRow>(
      `
      select
        controls.code,
        controls.title,
        controls.control_area,
        coalesce(
          array_agg(
            elements.element_number || ' ' || elements.title
            order by mappings.display_order asc
          ) filter (where elements.code is not null),
          array[]::text[]
        ) as sms_elements
      from sms_controls controls
      left join sms_control_element_mappings mappings
        on mappings.control_code = controls.code
      left join sms_elements elements
        on elements.code = mappings.element_code
      where controls.code in (
        'PLATFORM_READINESS_MAINTENANCE',
        'PILOT_READINESS',
        'MISSION_RISK_ASSESSMENT',
        'AIRSPACE_COMPLIANCE',
        'MISSION_READINESS_GATE',
        'MISSION_APPROVAL_GUARD',
        'MISSION_DISPATCH_GUARD',
        'AUDIT_EVIDENCE_SNAPSHOTS',
        'POST_OPERATION_REPORT_SIGNOFF'
      )
      group by
        controls.code,
        controls.title,
        controls.control_area,
        controls.display_order
      order by controls.display_order asc
      `,
    );

    return result.rows.map(toAuditReportSmsControlMapping);
  }

  async listSafetyActionClosureEvidenceForMissionExport(
    tx: PoolClient,
    missionId: string,
  ): Promise<SafetyActionClosureEvidenceExportContext[]> {
    const result = await tx.query<SafetyActionClosureEvidenceExportRow>(
      `
      select
        events.id as safety_event_id,
        events.event_type,
        events.severity as event_severity,
        events.status as event_status,
        events.summary as event_summary,
        events.event_occurred_at,
        events.sop_reference,
        evidence.safety_event_meeting_trigger_id,
        evidence.air_safety_meeting_id,
        evidence.safety_event_agenda_link_id,
        links.agenda_item,
        evidence.safety_action_proposal_id,
        proposals.proposal_type,
        proposals.status as proposal_status,
        proposals.summary as proposal_summary,
        proposals.proposed_owner as proposal_owner,
        proposals.proposed_due_at as proposal_due_at,
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', decisions.id,
                'decision', decisions.decision,
                'decidedBy', decisions.decided_by,
                'decisionNotes', decisions.decision_notes,
                'decidedAt', decisions.decided_at,
                'createdAt', decisions.created_at
              )
              order by decisions.decided_at asc, decisions.created_at asc, decisions.id asc
            )
            from safety_action_decisions decisions
            where decisions.safety_action_proposal_id = proposals.id
          ),
          '[]'::jsonb
        ) as decisions,
        evidence.id as implementation_evidence_id,
        evidence.evidence_category,
        evidence.implementation_summary,
        evidence.evidence_reference,
        evidence.completed_by,
        evidence.completed_at,
        evidence.reviewed_by,
        evidence.review_notes,
        evidence.created_at as evidence_created_at
      from safety_action_implementation_evidence evidence
      inner join safety_events events
        on events.id = evidence.safety_event_id
      inner join safety_event_agenda_links links
        on links.id = evidence.safety_event_agenda_link_id
      inner join safety_action_proposals proposals
        on proposals.id = evidence.safety_action_proposal_id
      where events.mission_id = $1
      order by evidence.completed_at desc, evidence.created_at desc, evidence.id desc
      `,
      [missionId],
    );

    return result.rows.map(toSafetyActionClosureEvidenceExportContext);
  }

  async listRegulatoryAmendmentAlertsForMissionExport(
    tx: PoolClient,
    missionId: string,
  ): Promise<RegulatoryAmendmentAlertAuditRecord[]> {
    const result = await tx.query<RegulatoryAmendmentAlertAuditRow>(
      `
      select
        id,
        status,
        severity,
        message,
        metadata,
        triggered_at,
        created_at,
        acknowledged_at,
        resolved_at
      from alerts
      where mission_id = $1
        and alert_type = 'REGULATORY_AMENDMENT'
      order by triggered_at asc, created_at asc, id asc
      `,
      [missionId],
    );

    return result.rows.map(toRegulatoryAmendmentAlertAuditRecord);
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
