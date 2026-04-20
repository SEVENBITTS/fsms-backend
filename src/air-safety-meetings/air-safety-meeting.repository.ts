import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  AirSafetyMeeting,
  AirSafetyMeetingPackExportAgendaItem,
  AirSafetyMeetingStatus,
  AirSafetyMeetingType,
} from "./air-safety-meeting.types";

interface AirSafetyMeetingRow extends QueryResultRow {
  id: string;
  meeting_type: AirSafetyMeetingType;
  scheduled_period_start: Date | string | null;
  scheduled_period_end: Date | string | null;
  due_at: Date;
  held_at: Date | null;
  status: AirSafetyMeetingStatus;
  chairperson: string | null;
  attendees: string[];
  agenda: string[];
  minutes: string | null;
  created_by: string | null;
  created_at: Date;
  closed_at: Date | null;
}

interface CreateAirSafetyMeetingRow {
  meetingType: AirSafetyMeetingType;
  scheduledPeriodStart: string | null;
  scheduledPeriodEnd: string | null;
  dueAt: Date;
  heldAt: Date | null;
  status: AirSafetyMeetingStatus;
  chairperson: string | null;
  attendees: string[];
  agenda: string[];
  minutes: string | null;
  createdBy: string | null;
}

interface AirSafetyMeetingPackExportAgendaItemRow extends QueryResultRow {
  agenda_item: AirSafetyMeetingPackExportAgendaItem;
}

const toDateOnly = (value: Date | string | null): string | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toAirSafetyMeeting = (row: AirSafetyMeetingRow): AirSafetyMeeting => ({
  id: row.id,
  meetingType: row.meeting_type,
  scheduledPeriodStart: toDateOnly(row.scheduled_period_start),
  scheduledPeriodEnd: toDateOnly(row.scheduled_period_end),
  dueAt: row.due_at.toISOString(),
  heldAt: row.held_at?.toISOString() ?? null,
  status: row.status,
  chairperson: row.chairperson,
  attendees: row.attendees,
  agenda: row.agenda,
  minutes: row.minutes,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString(),
  closedAt: row.closed_at?.toISOString() ?? null,
});

export class AirSafetyMeetingRepository {
  async insertAirSafetyMeeting(
    tx: PoolClient,
    input: CreateAirSafetyMeetingRow,
  ): Promise<AirSafetyMeeting> {
    const result = await tx.query<AirSafetyMeetingRow>(
      `
      insert into air_safety_meetings (
        id,
        meeting_type,
        scheduled_period_start,
        scheduled_period_end,
        due_at,
        held_at,
        status,
        chairperson,
        attendees,
        agenda,
        minutes,
        created_by,
        closed_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9::jsonb,
        $10::jsonb,
        $11,
        $12,
        case when $7 in ('completed', 'cancelled') then now() else null end
      )
      returning *
      `,
      [
        randomUUID(),
        input.meetingType,
        input.scheduledPeriodStart,
        input.scheduledPeriodEnd,
        input.dueAt,
        input.heldAt,
        input.status,
        input.chairperson,
        JSON.stringify(input.attendees),
        JSON.stringify(input.agenda),
        input.minutes,
        input.createdBy,
      ],
    );

    return toAirSafetyMeeting(result.rows[0]);
  }

  async listAirSafetyMeetings(tx: PoolClient): Promise<AirSafetyMeeting[]> {
    const result = await tx.query<AirSafetyMeetingRow>(
      `
      select *
      from air_safety_meetings
      order by due_at desc, created_at desc, id desc
      `,
    );

    return result.rows.map(toAirSafetyMeeting);
  }

  async getAirSafetyMeetingById(
    tx: PoolClient,
    meetingId: string,
  ): Promise<AirSafetyMeeting | null> {
    const result = await tx.query<AirSafetyMeetingRow>(
      `
      select *
      from air_safety_meetings
      where id = $1
      `,
      [meetingId],
    );

    return result.rows[0] ? toAirSafetyMeeting(result.rows[0]) : null;
  }

  async listAirSafetyMeetingPackAgendaItems(
    tx: PoolClient,
    meetingId: string,
  ): Promise<AirSafetyMeetingPackExportAgendaItem[]> {
    const result = await tx.query<AirSafetyMeetingPackExportAgendaItemRow>(
      `
      select jsonb_build_object(
        'link', jsonb_build_object(
          'id', links.id,
          'safetyEventId', links.safety_event_id,
          'safetyEventMeetingTriggerId', links.safety_event_meeting_trigger_id,
          'airSafetyMeetingId', links.air_safety_meeting_id,
          'agendaItem', links.agenda_item,
          'linkedBy', links.linked_by,
          'linkedAt', links.linked_at,
          'createdAt', links.created_at
        ),
        'safetyEvent', jsonb_build_object(
          'id', events.id,
          'eventType', events.event_type,
          'severity', events.severity,
          'status', events.status,
          'missionId', events.mission_id,
          'platformId', events.platform_id,
          'pilotId', events.pilot_id,
          'postOperationEvidenceSnapshotId', events.post_operation_evidence_snapshot_id,
          'reportedBy', events.reported_by,
          'eventOccurredAt', events.event_occurred_at,
          'reportedAt', events.reported_at,
          'summary', events.summary,
          'description', events.description,
          'immediateActionTaken', events.immediate_action_taken,
          'sopReference', events.sop_reference,
          'meetingRequired', events.meeting_required,
          'sopReviewRequired', events.sop_review_required,
          'trainingRequired', events.training_required,
          'maintenanceReviewRequired', events.maintenance_review_required,
          'accountableManagerReviewRequired', events.accountable_manager_review_required,
          'regulatorReportableReviewRequired', events.regulator_reportable_review_required,
          'createdAt', events.created_at,
          'updatedAt', events.updated_at
        ),
        'meetingTrigger', jsonb_build_object(
          'id', triggers.id,
          'safetyEventId', triggers.safety_event_id,
          'meetingRequired', triggers.meeting_required,
          'recommendedMeetingType', triggers.recommended_meeting_type,
          'triggerReasons', triggers.trigger_reasons,
          'reviewFlags', triggers.review_flags,
          'assessedBy', triggers.assessed_by,
          'assessedAt', triggers.assessed_at,
          'createdAt', triggers.created_at
        ),
        'actionProposals', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', proposals.id,
                'proposalType', proposals.proposal_type,
                'status', proposals.status,
                'summary', proposals.summary,
                'rationale', proposals.rationale,
                'proposedOwner', proposals.proposed_owner,
                'proposedDueAt', proposals.proposed_due_at,
                'createdBy', proposals.created_by,
                'createdAt', proposals.created_at,
                'updatedAt', proposals.updated_at,
                'decisions', coalesce(
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
                ),
                'implementationEvidence', coalesce(
                  (
                    select jsonb_agg(
                      jsonb_build_object(
                        'id', evidence.id,
                        'evidenceCategory', evidence.evidence_category,
                        'implementationSummary', evidence.implementation_summary,
                        'evidenceReference', evidence.evidence_reference,
                        'completedBy', evidence.completed_by,
                        'completedAt', evidence.completed_at,
                        'reviewedBy', evidence.reviewed_by,
                        'reviewNotes', evidence.review_notes,
                        'createdAt', evidence.created_at
                      )
                      order by evidence.completed_at desc, evidence.created_at desc, evidence.id desc
                    )
                    from safety_action_implementation_evidence evidence
                    where evidence.safety_action_proposal_id = proposals.id
                  ),
                  '[]'::jsonb
                )
              )
              order by proposals.created_at desc, proposals.id desc
            )
            from safety_action_proposals proposals
            where proposals.safety_event_agenda_link_id = links.id
          ),
          '[]'::jsonb
        )
      ) as agenda_item
      from safety_event_agenda_links links
      inner join safety_events events
        on events.id = links.safety_event_id
      inner join safety_event_meeting_triggers triggers
        on triggers.id = links.safety_event_meeting_trigger_id
      where links.air_safety_meeting_id = $1
      order by links.linked_at desc, links.created_at desc, links.id desc
      `,
      [meetingId],
    );

    return result.rows.map((row) => row.agenda_item);
  }

  async getLatestCompletedQuarterlyMeeting(
    tx: PoolClient,
    asOf: Date,
  ): Promise<AirSafetyMeeting | null> {
    const result = await tx.query<AirSafetyMeetingRow>(
      `
      select *
      from air_safety_meetings
      where meeting_type = 'quarterly_air_safety_review'
        and status = 'completed'
        and held_at <= $1
      order by held_at desc, created_at desc, id desc
      limit 1
      `,
      [asOf],
    );

    return result.rows[0] ? toAirSafetyMeeting(result.rows[0]) : null;
  }
}
