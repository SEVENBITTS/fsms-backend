import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  SafetyEvent,
  SafetyEventSeverity,
  SafetyEventStatus,
  SafetyEventType,
} from "./safety-event.types";

interface SafetyEventRow extends QueryResultRow {
  id: string;
  event_type: SafetyEventType;
  severity: SafetyEventSeverity;
  status: SafetyEventStatus;
  mission_id: string | null;
  platform_id: string | null;
  pilot_id: string | null;
  post_operation_evidence_snapshot_id: string | null;
  air_safety_meeting_id: string | null;
  reported_by: string | null;
  event_occurred_at: Date;
  reported_at: Date;
  summary: string;
  description: string | null;
  immediate_action_taken: string | null;
  sop_reference: string | null;
  meeting_required: boolean;
  sop_review_required: boolean;
  training_required: boolean;
  maintenance_review_required: boolean;
  accountable_manager_review_required: boolean;
  regulator_reportable_review_required: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CreateSafetyEventRow {
  eventType: SafetyEventType;
  severity: SafetyEventSeverity;
  status: SafetyEventStatus;
  missionId: string | null;
  platformId: string | null;
  pilotId: string | null;
  postOperationEvidenceSnapshotId: string | null;
  airSafetyMeetingId: string | null;
  reportedBy: string | null;
  eventOccurredAt: Date;
  summary: string;
  description: string | null;
  immediateActionTaken: string | null;
  sopReference: string | null;
  meetingRequired: boolean;
  sopReviewRequired: boolean;
  trainingRequired: boolean;
  maintenanceReviewRequired: boolean;
  accountableManagerReviewRequired: boolean;
  regulatorReportableReviewRequired: boolean;
}

const toSafetyEvent = (row: SafetyEventRow): SafetyEvent => ({
  id: row.id,
  eventType: row.event_type,
  severity: row.severity,
  status: row.status,
  missionId: row.mission_id,
  platformId: row.platform_id,
  pilotId: row.pilot_id,
  postOperationEvidenceSnapshotId: row.post_operation_evidence_snapshot_id,
  airSafetyMeetingId: row.air_safety_meeting_id,
  reportedBy: row.reported_by,
  eventOccurredAt: row.event_occurred_at.toISOString(),
  reportedAt: row.reported_at.toISOString(),
  summary: row.summary,
  description: row.description,
  immediateActionTaken: row.immediate_action_taken,
  sopReference: row.sop_reference,
  meetingRequired: row.meeting_required,
  sopReviewRequired: row.sop_review_required,
  trainingRequired: row.training_required,
  maintenanceReviewRequired: row.maintenance_review_required,
  accountableManagerReviewRequired: row.accountable_manager_review_required,
  regulatorReportableReviewRequired: row.regulator_reportable_review_required,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class SafetyEventRepository {
  async insertSafetyEvent(
    tx: PoolClient,
    input: CreateSafetyEventRow,
  ): Promise<SafetyEvent> {
    const result = await tx.query<SafetyEventRow>(
      `
      insert into safety_events (
        id,
        event_type,
        severity,
        status,
        mission_id,
        platform_id,
        pilot_id,
        post_operation_evidence_snapshot_id,
        air_safety_meeting_id,
        reported_by,
        event_occurred_at,
        summary,
        description,
        immediate_action_taken,
        sop_reference,
        meeting_required,
        sop_review_required,
        training_required,
        maintenance_review_required,
        accountable_manager_review_required,
        regulator_reportable_review_required
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      returning *
      `,
      [
        randomUUID(),
        input.eventType,
        input.severity,
        input.status,
        input.missionId,
        input.platformId,
        input.pilotId,
        input.postOperationEvidenceSnapshotId,
        input.airSafetyMeetingId,
        input.reportedBy,
        input.eventOccurredAt,
        input.summary,
        input.description,
        input.immediateActionTaken,
        input.sopReference,
        input.meetingRequired,
        input.sopReviewRequired,
        input.trainingRequired,
        input.maintenanceReviewRequired,
        input.accountableManagerReviewRequired,
        input.regulatorReportableReviewRequired,
      ],
    );

    return toSafetyEvent(result.rows[0]);
  }

  async listSafetyEvents(tx: PoolClient): Promise<SafetyEvent[]> {
    const result = await tx.query<SafetyEventRow>(
      `
      select *
      from safety_events
      order by event_occurred_at desc, reported_at desc, id desc
      `,
    );

    return result.rows.map(toSafetyEvent);
  }

  async referenceExists(
    tx: PoolClient,
    tableName:
      | "missions"
      | "platforms"
      | "pilots"
      | "post_operation_evidence_snapshots"
      | "air_safety_meetings",
    id: string,
  ): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from ${tableName}
      where id = $1
      `,
      [id],
    );

    return result.rowCount === 1;
  }
}
