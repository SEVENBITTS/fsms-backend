import { Pool } from "pg";
import {
  TimelineEvent,
  TimelineEventSchema,
  TimelineQuery,
  TimelineResponse,
  TimelineResponseSchema,
  TimelineWriteInput,
  TimelineWriteResponse
} from "../schemas/timeline.schemas";
import { TimelineRepository, type RawTimelineRow } from "../repositories/timeline.repository";
import { HttpError } from "../utils/errors";
import { clampLimit } from "../utils/parse";

function normalizeInteger(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected integer-compatible value, got: ${value}`);
  }

  return parsed;
}

function normalizeRow(row: RawTimelineRow): TimelineEvent {
  const event: TimelineEvent = {
    id: Number(row.id),
    sequence: Number(row.sequence),
    missionId: normalizeInteger(row.mission_id),
    aircraftId: normalizeInteger(row.aircraft_id),
    eventType: row.event_type,
    eventTime: new Date(row.event_time).toISOString(),
    classified: Boolean(row.classified),
    legacy: Boolean(row.legacy),
    payload: row.payload as Record<string, unknown>,
    createdAt: new Date(row.created_at).toISOString()
  };

  return TimelineEventSchema.parse(event);
}

function isPgError(error: unknown): error is { code?: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

export class TimelineService {
  private readonly timelineRepository: TimelineRepository;

  constructor(pool: Pool) {
  this.timelineRepository = new TimelineRepository(pool);
}

  async listTimelineEvents(filters: TimelineQuery): Promise<TimelineResponse> {
    if (
      filters.startAt !== undefined &&
      filters.endAt !== undefined &&
      new Date(filters.startAt) >= new Date(filters.endAt)
    ) {
      throw new HttpError(400, "startAt must be before endAt");
    }

    if (
      filters.afterSequence !== undefined &&
      filters.beforeSequence !== undefined &&
      filters.afterSequence >= filters.beforeSequence
    ) {
      throw new HttpError(400, "afterSequence must be less than beforeSequence");
    }

    const requestedLimit = clampLimit(filters.limit ?? 50);
    const rows = await this.timelineRepository.listTimelineEvents(filters, requestedLimit);

    const hasMore = rows.length > requestedLimit;
    const pageRows = hasMore ? rows.slice(0, requestedLimit) : rows;

    const items = pageRows.map(normalizeRow);
    const nextCursor =
      hasMore && items.length > 0 ? items[items.length - 1].sequence : null;

    return TimelineResponseSchema.parse({
      items,
      pageInfo: {
        limit: requestedLimit,
        nextCursor,
        hasMore
      }
    });
  }

  async appendTimelineEvent(input: TimelineWriteInput): Promise<TimelineWriteResponse> {
    try {
      const row = await this.timelineRepository.appendTimelineEvent({
        missionId: input.missionId,
        aircraftId: input.aircraftId,
        eventType: input.eventType,
        eventTime: input.eventTime,
        classified: input.classified,
        payload: input.payload
      });

      return {
        item: normalizeRow(row)
      };
    } catch (error: unknown) {
      if (isPgError(error)) {
        if (error.code === "22007") {
          throw new HttpError(400, "eventTime must be a valid ISO datetime");
        }

        if (error.code === "23505") {
          throw new HttpError(409, "Failed to assign timeline sequence");
        }
      }

      throw error;
    }
  }
}