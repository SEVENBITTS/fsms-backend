import { PoolClient } from "pg";
import { missionEventRegistry } from "./mission-event-registry";
import { MissionEventType } from "./mission-event-types";

export type DbTx = PoolClient;

export type ActorType = "user" | "system" | "integration";
export type Severity = "info" | "warning" | "critical";

export interface MissionSequenceAllocator {
  bumpLastEventSequence(tx: DbTx, missionId: string): Promise<number>;
}

export interface AppendMissionEventInput {
  missionId: string;
  missionPlanId?: string | null;

  eventType: MissionEventType;
  eventTs?: Date;

  actorType: ActorType;
  actorId?: string | null;

  fromState?: string | null;
  toState?: string | null;

  summary: string;
  details?: Record<string, unknown>;

  source?: string;
  sourceComponent?: string;

  causationId?: number | null;
  correlationId?: string | null;
  requestId?: string | null;

  severity?: Severity | null;
  safetyRelevant?: boolean;
  complianceRelevant?: boolean;

  metadata?: Record<string, unknown>;
}

export interface MissionEventRow {
  id: number;
  mission_id: string;
  mission_plan_id: string | null;
  event_type: string;
  event_version: number;
  event_ts: string;
  recorded_at: string;
  sequence_no: number;
  actor_type: ActorType;
  actor_id: string | null;
  from_state: string | null;
  to_state: string | null;
  summary: string;
  details: Record<string, unknown>;
  source_component: string | null;
  source: string;
  causation_id: number | null;
  correlation_id: string | null;
  request_id: string | null;
  severity: Severity | null;
  safety_relevant: boolean;
  compliance_relevant: boolean;
  metadata: Record<string, unknown>;
  supersedes_event_id: number | null;
}

export interface MissionEventFilters {
  safety?: boolean;
  compliance?: boolean;
  severity?: "info" | "warning" | "critical";
  type?: string;
}

export class MissionEventRepository {
  async append(
    tx: DbTx,
    missionSequenceAllocator: MissionSequenceAllocator,
    input: AppendMissionEventInput,
  ): Promise<number> {
    const registryEntry = missionEventRegistry[input.eventType];
    if (!registryEntry) {
      throw new Error(`Unsupported mission event type: ${input.eventType}`);
    }

    this.validateInput(input);

    const sequenceNo = await missionSequenceAllocator.bumpLastEventSequence(
      tx,
      input.missionId,
    );

    const safetyRelevant =
      input.safetyRelevant ?? registryEntry.safetyRelevant;
    const complianceRelevant =
      input.complianceRelevant ?? registryEntry.complianceRelevant;
    const severity = input.severity ?? registryEntry.severity ?? "info";

    const source = this.normalizeSource(input.source, input.sourceComponent);
    const sourceComponent = input.sourceComponent ?? source;
    const eventTs = input.eventTs ?? new Date();

    const result = await tx.query<{ id: number }>(
      `
      insert into mission_events (
        mission_id,
        mission_plan_id,
        event_type,
        event_version,
        event_ts,
        recorded_at,
        sequence_no,
        actor_type,
        actor_id,
        from_state,
        to_state,
        summary,
        details,
        source_component,
        source,
        causation_id,
        correlation_id,
        request_id,
        severity,
        safety_relevant,
        compliance_relevant,
        metadata
      ) values (
        $1,  -- mission_id
        $2,  -- mission_plan_id
        $3,  -- event_type
        1,   -- event_version
        $4,  -- event_ts
        now(),
        $5,  -- sequence_no
        $6,  -- actor_type
        $7,  -- actor_id
        $8,  -- from_state
        $9,  -- to_state
        $10, -- summary
        $11::jsonb, -- details
        $12, -- source_component
        $13, -- source
        $14, -- causation_id
        $15, -- correlation_id
        $16, -- request_id
        $17, -- severity
        $18, -- safety_relevant
        $19, -- compliance_relevant
        $20::jsonb -- metadata
      )
      returning id
      `,
      [
        input.missionId,
        input.missionPlanId ?? null,
        input.eventType,
        eventTs,
        sequenceNo,
        input.actorType,
        input.actorId ?? null,
        input.fromState ?? null,
        input.toState ?? null,
        input.summary.trim(),
        JSON.stringify(input.details ?? {}),
        sourceComponent,
        source,
        input.causationId ?? null,
        input.correlationId ?? null,
        input.requestId ?? null,
        severity,
        safetyRelevant,
        complianceRelevant,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    return Number(result.rows[0].id);
  }

  async getTimeline(tx: DbTx, missionId: string): Promise<MissionEventRow[]> {
    const result = await tx.query<MissionEventRow>(
      `
      select
        id,
        mission_id,
        mission_plan_id,
        event_type,
        event_version,
        event_ts,
        recorded_at,
        sequence_no,
        actor_type,
        actor_id,
        from_state,
        to_state,
        summary,
        details,
        source_component,
        source,
        causation_id,
        correlation_id,
        request_id,
        severity,
        safety_relevant,
        compliance_relevant,
        metadata,
        supersedes_event_id
      from mission_events
      where mission_id = $1
      order by sequence_no asc
      `,
      [missionId],
    );

    return result.rows;
  }

  async getTimelineFiltered(
  tx: DbTx,
  missionId: string,
  filters: MissionEventFilters,
): Promise<MissionEventRow[]> {
  const conditions: string[] = ["mission_id = $1"];
  const values: unknown[] = [missionId];
  let paramIndex = 2;

  if (typeof filters.safety === "boolean") {
    conditions.push(`safety_relevant = $${paramIndex}`);
    values.push(filters.safety);
    paramIndex += 1;
  }

  if (typeof filters.compliance === "boolean") {
    conditions.push(`compliance_relevant = $${paramIndex}`);
    values.push(filters.compliance);
    paramIndex += 1;
  }

  if (filters.severity) {
    conditions.push(`severity = $${paramIndex}`);
    values.push(filters.severity);
    paramIndex += 1;
  }

  if (filters.type) {
    conditions.push(`event_type = $${paramIndex}`);
    values.push(filters.type);
    paramIndex += 1;
  }

  const query = `
    select
      id,
      mission_id,
      mission_plan_id,
      event_type,
      event_version,
      event_ts,
      recorded_at,
      sequence_no,
      actor_type,
      actor_id,
      from_state,
      to_state,
      summary,
      details,
      source_component,
      source,
      causation_id,
      correlation_id,
      request_id,
      severity,
      safety_relevant,
      compliance_relevant,
      metadata,
      supersedes_event_id
    from mission_events
    where ${conditions.join(" and ")}
    order by sequence_no asc
  `;

  const result = await tx.query<MissionEventRow>(query, values);
  return result.rows;
}

  async getSafetyEvents(
    tx: DbTx,
    missionId: string,
  ): Promise<MissionEventRow[]> {
    const result = await tx.query<MissionEventRow>(
      `
      select
        id,
        mission_id,
        mission_plan_id,
        event_type,
        event_version,
        event_ts,
        recorded_at,
        sequence_no,
        actor_type,
        actor_id,
        from_state,
        to_state,
        summary,
        details,
        source_component,
        source,
        causation_id,
        correlation_id,
        request_id,
        severity,
        safety_relevant,
        compliance_relevant,
        metadata,
        supersedes_event_id
      from mission_events
      where mission_id = $1
        and safety_relevant = true
      order by sequence_no asc
      `,
      [missionId],
    );

    return result.rows;
  }

  private validateInput(input: AppendMissionEventInput): void {
    if (!input.missionId) {
      throw new Error("missionId is required");
    }

    if (!input.eventType) {
      throw new Error("eventType is required");
    }

    if (!input.actorType) {
      throw new Error("actorType is required");
    }

    if (!input.summary || input.summary.trim().length === 0) {
      throw new Error("summary is required");
    }

    if (input.summary.trim().length > 1000) {
      throw new Error("summary is too long");
    }
  }

  private normalizeSource(
    source?: string | null,
    sourceComponent?: string | null,
  ): string {
    const value = source ?? sourceComponent ?? "mission-service";
    const trimmed = value.trim();

    if (!trimmed) {
      return "mission-service";
    }

    return trimmed;
  }
}