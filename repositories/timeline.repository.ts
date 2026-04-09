import type { Pool } from "pg";

export type AppendTimelineEventParams = {
  missionId?: number;
  aircraftId?: number;
  eventType: string;
  eventTime: string;
  classified: boolean;
  payload: Record<string, unknown>;
};

export type TimelineRow = {
  id: number | string;
  sequence: number | string;
  mission_id: number | string | null;
  aircraft_id: number | string | null;
  event_type: string;
  event_time: string | Date;
  classified: boolean;
  legacy: boolean;
  payload: Record<string, unknown> | null;
  created_at: string | Date;
};

export class TimelineRepository {
  constructor(private readonly pool: Pool) {}

  async appendTimelineEvent(input: AppendTimelineEventParams): Promise<TimelineRow> {
    const result = await this.pool.query<TimelineRow>(
      `
        INSERT INTO timeline (
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

    return result.rows[0];
  }
}