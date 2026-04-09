import { z } from "zod";

const booleanFromString = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }

  return value;
}, z.boolean());

const numberFromString = z.preprocess((value) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return value;
}, z.number());

const optionalEventType = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value
        .flatMap((part) => part.split(","))
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  });

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

const jsonObjectSchema: z.ZodType<Record<string, unknown>> = z
  .record(z.string(), jsonValueSchema)
  .default({});

export const TimelineQuerySchema = z.object({
  missionId: numberFromString.optional(),
  aircraftId: numberFromString.optional(),
  eventType: optionalEventType,
  classified: booleanFromString.optional(),
  legacy: booleanFromString.optional(),
  afterSequence: numberFromString.optional(),
  beforeSequence: numberFromString.optional(),
  startAt: z.string().datetime({ offset: true }).optional(),
  endAt: z.string().datetime({ offset: true }).optional(),
  limit: numberFromString.optional().transform((value) => value ?? 50)
});

export type TimelineQuery = z.infer<typeof TimelineQuerySchema>;

export const TimelineEventSchema = z.object({
  id: z.number().int(),
  sequence: z.number().int(),
  missionId: z.number().int().nullable(),
  aircraftId: z.number().int().nullable(),
  eventType: z.string(),
  eventTime: z.string().datetime({ offset: true }),
  classified: z.boolean(),
  legacy: z.boolean(),
  payload: jsonObjectSchema,
  createdAt: z.string().datetime({ offset: true })
});

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const TimelineResponseSchema = z.object({
  items: z.array(TimelineEventSchema),
  pageInfo: z.object({
    limit: z.number().int(),
    nextCursor: z.number().int().nullable(),
    hasMore: z.boolean()
  })
});

export type TimelineResponse = z.infer<typeof TimelineResponseSchema>;

export const TimelineWriteSchema = z
  .object({
    missionId: z.coerce.number().int().positive().optional(),
    aircraftId: z.coerce.number().int().positive().optional(),
    eventType: z.string().trim().min(1, "eventType is required"),
    eventTime: z
      .string()
      .datetime({ offset: true, message: "eventTime must be a valid ISO datetime" }),
    classified: z.boolean().default(false),
    payload: jsonObjectSchema,
  })
  .strict();

export type TimelineWriteInput = z.infer<typeof TimelineWriteSchema>;

export const TimelineWriteResponseSchema = z.object({
  item: TimelineEventSchema
});

export type TimelineWriteResponse = z.infer<typeof TimelineWriteResponseSchema>;