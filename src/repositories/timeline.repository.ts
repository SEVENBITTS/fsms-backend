import { Pool } from "pg";
import type { TimelineQuery } from "../schemas/timeline.schemas";

export type RawTimelineRow = {
  id: string | number;
  sequence: string | number;
  mission_id: string | number | null;
  aircraft_id: string | number | null;
  event_type: string;
  event_time: Date | string;
  classified: boolean;
  legacy: boolean;
  payload: unknown;
  created_at: Date | string;
};

export type AppendTimelineEventParams = {
  missionId?: number;
  aircraftId?: number;
  eventType: string;
  eventTime: string;
  classified: boolean;
  payload: Record<string, unknown>;
};

type SqlBuildResult = {
  sql: string;
  values: unknown[];
};

function buildTimelineQuerySql(filters: TimelineQuery, limit: number): SqlBuildResult {
  const where: string[] = [];
  const values: unknown[] = [];

  const push = (clauseWithQuestionMark: string, value: unknown) => {
    values.push(value);
    where.push(clauseWithQuestionMark.replace("?", `$${values.length}`));
  };

  if (filters.missionId !== undefined) push("mission_id = ?", filters.missionId);
  if (filters.aircraftId !== undefined) push("aircraft_id = ?", filters.aircraftId);
  if (filters.classified !== undefined) push("classified = ?", filters.classified);
  if (filters.legacy !== undefined) push("legacy = ?", filters.legacy);
  if (filters.afterSequence !== undefined) push("sequence > ?", filters.afterSequence);
  if (filters.beforeSequence !== undefined) push("sequence < ?", filters.beforeSequence);
  if (filters.startAt !== undefined) push("event_time >= ?", filters.startAt);
  if (filters.endAt !== undefined) push("event_time < ?", filters.endAt);

  if (filters.eventType && filters.eventType.length > 0) {
    const placeholders = filters.eventType.map((eventType) => {
      values.push(eventType);
      return `$${values.length}`;
    });

    where.push(`event_type IN (${placeholders.join(", ")})`);
  }

  values.push(limit + 1);
  const limitPlaceholder = `$${values.length}`;

  const sql = `
    SELECT
      id,
      sequence,
      mission_id,
      aircraft_id,
      event_type,
      event_time,
      classified,
      legacy,
      payload,
      created_at
    FROM timeline_events
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY sequence ASC
    LIMIT ${limitPlaceholder}
  `;

  return { sql, values };
}

export class TimelineRepository {
  constructor(private readonly pool: Pool) {}

  async listTimelineEvents(filters: TimelineQuery, limit: number): Promise<RawTimelineRow[]> {
    const { sql, values } = buildTimelineQuerySql(filters, limit);
    const result = await this.pool.query<RawTimelineRow>(sql, values);
    return result.rows;
  }

  async appendTimelineEvent(input: AppendTimelineEventParams): Promise<RawTimelineRow> {
    const result = await this.pool.query<RawTimelineRow>(
      `
        INSERT INTO timeline_events (
          mission_id,
          aircraft_id,
          event_type,
          event_time,
          classified,
          legacy,
          payload
        )
        VALUES ($1, $2, $3, $4::timestamptz, $5, false, $6::jsonb)
        RETURNING
          id,
          sequence,
          mission_id,
          aircraft_id,
          event_type,
          event_time,
          classified,
          legacy,
          payload,
          created_at
      `,
      [
        input.missionId ?? null,
        input.aircraftId ?? null,
        input.eventType,
        input.eventTime,
        input.classified,
        JSON.stringify(input.payload),
      ]
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to append timeline event");
    }

    return row;
  }
}