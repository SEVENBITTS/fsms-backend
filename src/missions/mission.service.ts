import { Pool } from "pg";
import { MissionRepository } from "./mission.repository";
import { MissionEventRepository } from "./mission-event.repository";
import {
  assertMissionActionAllowed,
  checkMissionActionAllowed,
  MissionLifecycleAction,
} from "../modules/missions/domain/missionLifecycle";

export interface GetMissionEventsFilters {
  safety?: boolean;
  compliance?: boolean;
  severity?: "info" | "warning" | "critical";
  type?: string;
}


export class Db {
  constructor(private readonly pool: Pool) {}

  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}



export class MissionService {
  constructor(
    private readonly db: Db,
    private readonly missionRepo: MissionRepository,
    private readonly missionEventRepo: MissionEventRepository,
  ) {}

  async submitMission(params: {
    missionId: string;
    userId: string;
    requestId?: string;
    correlationId?: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const mission = await this.missionRepo.getForUpdate(tx, params.missionId);

      assertMissionActionAllowed(mission.status, "submit");

      await this.missionRepo.updateStatus(tx, params.missionId, "submitted");

      await this.missionEventRepo.append(tx, this.missionRepo, {
        missionId: mission.id,
        missionPlanId: mission.mission_plan_id,
        eventType: "mission.submitted",
        actorType: "user",
        actorId: params.userId,
        fromState: mission.status,
        toState: "submitted",
        summary: "Mission submitted for review",
        details: {
          reason: "operator_submitted_for_review",
        },
        source: "mission-service",
        requestId: params.requestId ?? null,
        correlationId: params.correlationId ?? null,
      });
    });
  }

  async approveMission(params: {
  missionId: string;
  reviewerId: string;
  notes?: string;
  requestId?: string;
  correlationId?: string;
}): Promise<void> {
  await this.db.transaction(async (tx) => {
    const mission = await this.missionRepo.getForUpdate(tx, params.missionId);

    assertMissionActionAllowed(mission.status, "approve");

    await this.missionRepo.updateStatus(tx, params.missionId, "approved");

    await this.missionEventRepo.append(tx, this.missionRepo, {
      missionId: mission.id,
      missionPlanId: mission.mission_plan_id,
      eventType: "mission.approved",
      actorType: "user",
      actorId: params.reviewerId,
      fromState: mission.status,
      toState: "approved",
      summary: "Mission approved",
      details: {
        decision: "approved",
        notes: params.notes ?? null,
      },
      source: "mission-review-service",
      requestId: params.requestId ?? null,
      correlationId: params.correlationId ?? null,
    });
  });
} 

  async launchMission(params: {
    missionId: string;
    operatorId: string;
    vehicleId: string;
    lat: number;
    lng: number;
    requestId?: string;
    correlationId?: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const mission = await this.missionRepo.getForUpdate(tx, params.missionId);
      
      assertMissionActionAllowed(mission.status, "launch");

      
      await this.missionRepo.updateStatus(tx, params.missionId, "active");

      await this.missionEventRepo.append(tx, this.missionRepo, {
        missionId: mission.id,
        missionPlanId: mission.mission_plan_id,
        eventType: "mission.launched",
        actorType: "user",
        actorId: params.operatorId,
        fromState: mission.status,
        toState: "active",
        summary: "Mission launched",
        details: {
          vehicle_id: params.vehicleId,
          launch_site: {
            lat: params.lat,
            lng: params.lng,
          },
        },
        source: "ops-console",
        requestId: params.requestId ?? null,
        correlationId: params.correlationId ?? null,
      });
    });
  }

  async completeMission(params: {
    missionId: string;
    operatorId?: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const mission = await this.missionRepo.getForUpdate(tx, params.missionId);
      
      assertMissionActionAllowed(mission.status, "complete");
      
      await this.missionRepo.updateStatus(tx, params.missionId, "completed");

      await this.missionEventRepo.append(tx, this.missionRepo, {
        missionId: mission.id,
        missionPlanId: mission.mission_plan_id,
        eventType: "mission.completed",
        actorType: params.operatorId ? "user" : "system",
        actorId: params.operatorId ?? null,
        fromState: mission.status,
        toState: "completed",
        summary: "Mission completed",
        details: {},
        source: "mission-service",
      });
    });
  }

  async abortMission(params: {
    missionId: string;
    actorId?: string;
    reason: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const mission = await this.missionRepo.getForUpdate(tx, params.missionId);

      assertMissionActionAllowed(mission.status, "abort");

      await this.missionRepo.updateStatus(tx, params.missionId, "aborted");

      await this.missionEventRepo.append(tx, this.missionRepo, {
        missionId: mission.id,
        missionPlanId: mission.mission_plan_id,
        eventType: "mission.aborted",
        actorType: params.actorId ? "user" : "system",
        actorId: params.actorId ?? null,
        fromState: mission.status,
        toState: "aborted",
        summary: "Mission aborted",
        details: {
          reason: params.reason,
        },
        source: "ops-console",
      });
    });
  }

  async checkMissionTransition(params: {
  missionId: string;
  action: MissionLifecycleAction;
}) {
  return this.db.transaction(async (tx) => {
    const mission = await this.missionRepo.getForUpdate(tx, params.missionId);

    const result = checkMissionActionAllowed(mission.status, params.action);

    return {
      missionId: mission.id,
      currentStatus: result.currentStatus,
      action: result.action,
      targetStatus: result.targetStatus,
      allowed: result.allowed,
      error: result.error,
    };
  });
}

  async getMissionEvents(
    missionId: string,
    filters: GetMissionEventsFilters = {},
  ) {
    return this.db.transaction(async (tx) => {
      const rows = await this.missionEventRepo.getTimelineFiltered(
        tx,
        missionId,
        filters,
      );

      return rows.map((row) => ({
        id: Number(row.id),
        sequence: Number(row.sequence_no),
        type: row.event_type,
        version: row.event_version,
        time: row.event_ts,
        recordedAt: row.recorded_at,
        actorType: row.actor_type,
        actorId: row.actor_id,
        fromState: row.from_state,
        toState: row.to_state,
        summary: row.summary,
        details: row.details,
        source: row.source,
        severity: row.severity,
        safety: row.safety_relevant,
        compliance: row.compliance_relevant,
        correlationId: row.correlation_id,
        requestId: row.request_id,
      }));
    });
  }
}