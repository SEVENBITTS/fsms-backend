import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  AirSafetyMeeting,
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
