import { ZodError } from "zod";
import {
  TimelineEvent,
  TimelineEventSchema,
  TimelineQuery,
  TimelineResponse,
  TimelineResponseSchema,
  TimelineWriteInput,
  TimelineWriteResponse,
  TimelineWriteSchema
} from "../schemas/timeline.schemas";
import { TimelineRepository, type TimelineRow } from "../repositories/timeline.repository";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly type: string = "http_error"
  ) {
    super(message);
  }
}

export type TimelineItem = {
  id: number;
  sequence: number;
  missionId: number | null;
  aircraftId: number | null;
  eventType: string;
  eventTime: string;
  classified: boolean;
  legacy: boolean;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type TimelineWriteResponse = {
  item: TimelineItem;
};

export class TimelineService {
  constructor(private readonly timelineRepository: TimelineRepository) {}

  async appendTimelineEvent(rawInput: unknown): Promise<TimelineWriteResponse> {
    try {
      const input = TimelineWriteSchema.parse(rawInput);

      const row = await this.timelineRepository.appendTimelineEvent({
        missionId: input.missionId,
        aircraftId: input.aircraftId,
        eventType: input.eventType,
        eventTime: input.eventTime,
        classified: input.classified,
        payload: input.payload,
      });

      return {
        item: normalizeTimelineRow(row),
      };
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        throw new HttpError(400, issue?.message ?? "Invalid request body");
      }

      if (isPgError(error)) {
        if (error.code === "22007") {
          throw new HttpError(400, "eventTime must be a valid ISO datetime");
        }

        if (error.code === "23505") {
          throw new HttpError(409, "Failed to assign timeline sequence");
        }
      }

      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(500, "Failed to append timeline event");
    }
  }
}

function normalizeTimelineRow(row: TimelineRow): TimelineItem {
  return {
    id: Number(row.id),
    sequence: Number(row.sequence),
    missionId: row.mission_id == null ? null : Number(row.mission_id),
    aircraftId: row.aircraft_id == null ? null : Number(row.aircraft_id),
    eventType: row.event_type,
    eventTime: new Date(row.event_time).toISOString(),
    classified: Boolean(row.classified),
    legacy: Boolean(row.legacy),
    payload: row.payload ?? {},
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function isPgError(error: unknown): error is { code?: string } {
  return typeof error === "object" && error !== null && "code" in error;
}