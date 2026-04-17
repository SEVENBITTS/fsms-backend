import { Pool } from "pg";
import { MissionRepository } from "./mission.repository";
import { MissionEventRepository } from "./mission-event.repository";
import {
  assertMissionActionAllowed,
  checkMissionActionAllowed,
  MissionLifecycleAction,
} from "../modules/missions/domain/missionLifecycle";
import { PlatformNotFoundError } from "../platforms/platform.errors";
import { PlatformService } from "../platforms/platform.service";
import { PilotNotFoundError } from "../pilots/pilot.errors";
import { PilotService } from "../pilots/pilot.service";
import { MissionRiskService } from "../mission-risk/mission-risk.service";
import type {
  MissionReadinessCheck,
  MissionReadinessReason,
  MissionReadinessResult,
} from "./mission-readiness.types";
import type { PilotReadinessResult } from "../pilots/pilot.types";
import type { MissionRiskResult } from "../mission-risk/mission-risk.types";

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
    private readonly platformService?: PlatformService,
    private readonly pilotService?: PilotService,
    private readonly missionRiskService?: MissionRiskService,
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

  async checkMissionReadiness(params: {
    missionId: string;
    platformId?: string;
    pilotId?: string;
  }): Promise<MissionReadinessCheck> {
    const mission = await this.db.transaction(async (tx) =>
      this.missionRepo.getById(tx, params.missionId),
    );
    const platformId = params.platformId ?? mission.platform_id;
    const pilotId = params.pilotId ?? mission.pilot_id;
    const reasons: MissionReadinessReason[] = [];
    let platformReadiness: MissionReadinessCheck["platformReadiness"] = null;
    let pilotReadiness: MissionReadinessCheck["pilotReadiness"] = null;
    let missionRisk: MissionReadinessCheck["missionRisk"] = null;

    if (!platformId) {
      reasons.push({
        code: "MISSION_PLATFORM_NOT_ASSIGNED",
        severity: "fail",
        message: "Mission has no assigned platform for readiness evaluation",
        source: "mission",
      });
    } else if (!this.platformService) {
      reasons.push({
            code: "MISSION_PLATFORM_NOT_FOUND",
            severity: "fail",
            message: "Platform readiness service is not available",
            source: "mission",
            relatedPlatformId: platformId,
      });
    } else {
      try {
        platformReadiness =
          await this.platformService.checkPlatformReadiness(platformId);
        reasons.push(
          this.mapPlatformReadinessReason(
            platformReadiness.result,
            platformId,
            platformReadiness.reasons.map((reason) => reason.code),
          ),
        );
      } catch (error) {
        if (!(error instanceof PlatformNotFoundError)) {
          throw error;
        }

        reasons.push({
              code: "MISSION_PLATFORM_NOT_FOUND",
              severity: "fail",
              message: `Assigned platform was not found: ${platformId}`,
              source: "mission",
              relatedPlatformId: platformId,
        });
      }
    }

    if (!pilotId) {
      reasons.push({
        code: "MISSION_PILOT_NOT_ASSIGNED",
        severity: "fail",
        message: "Mission has no assigned pilot for readiness evaluation",
        source: "mission",
      });
    } else if (!this.pilotService) {
      reasons.push({
        code: "MISSION_PILOT_NOT_FOUND",
        severity: "fail",
        message: "Pilot readiness service is not available",
        source: "mission",
        relatedPilotId: pilotId,
      });
    } else {
      try {
        pilotReadiness = await this.pilotService.checkPilotReadiness(pilotId);
        reasons.push(
          this.mapPilotReadinessReason(
            pilotReadiness.result,
            pilotId,
            pilotReadiness.reasons.map((reason) => reason.code),
          ),
        );
      } catch (error) {
        if (!(error instanceof PilotNotFoundError)) {
          throw error;
        }

        reasons.push({
          code: "MISSION_PILOT_NOT_FOUND",
          severity: "fail",
          message: `Assigned pilot was not found: ${pilotId}`,
          source: "mission",
          relatedPilotId: pilotId,
        });
      }
    }

    if (!this.missionRiskService) {
      reasons.push({
        code: "MISSION_RISK_FAILED",
        severity: "fail",
        message: "Mission risk assessment service is not available",
        source: "mission",
      });
    } else {
      missionRisk = await this.missionRiskService.assessMissionRisk(mission.id);
      reasons.push(
        this.mapMissionRiskReason(
          missionRisk.result,
          missionRisk.reasons.map((reason) => reason.code),
        ),
      );
    }

    return this.buildMissionReadiness({
      missionId: mission.id,
      platformId,
      pilotId,
      reasons,
      platformReadiness,
      pilotReadiness,
      missionRisk,
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

  private mapPlatformReadinessReason(
    result: MissionReadinessResult,
    platformId: string,
    platformReasonCodes: string[],
  ): MissionReadinessReason {
    if (result === "fail") {
      return {
        code: "MISSION_PLATFORM_FAILED",
        severity: "fail",
        message: "Assigned platform fails readiness and blocks mission approval or dispatch",
        source: "platform",
        relatedPlatformId: platformId,
        relatedPlatformReasonCodes: platformReasonCodes,
      };
    }

    if (result === "warning") {
      return {
        code: "MISSION_PLATFORM_WARNING",
        severity: "warning",
        message: "Assigned platform has readiness warnings requiring review before approval or dispatch",
        source: "platform",
        relatedPlatformId: platformId,
        relatedPlatformReasonCodes: platformReasonCodes,
      };
    }

    return {
      code: "MISSION_PLATFORM_READY",
      severity: "pass",
      message: "Assigned platform passes readiness for mission approval and dispatch",
      source: "platform",
      relatedPlatformId: platformId,
      relatedPlatformReasonCodes: platformReasonCodes,
    };
  }

  private mapPilotReadinessReason(
    result: PilotReadinessResult,
    pilotId: string,
    pilotReasonCodes: string[],
  ): MissionReadinessReason {
    if (result === "fail") {
      return {
        code: "MISSION_PILOT_FAILED",
        severity: "fail",
        message: "Assigned pilot fails readiness and blocks mission approval or dispatch",
        source: "pilot",
        relatedPilotId: pilotId,
        relatedPilotReasonCodes: pilotReasonCodes,
      };
    }

    if (result === "warning") {
      return {
        code: "MISSION_PILOT_WARNING",
        severity: "warning",
        message: "Assigned pilot has readiness warnings requiring review before approval or dispatch",
        source: "pilot",
        relatedPilotId: pilotId,
        relatedPilotReasonCodes: pilotReasonCodes,
      };
    }

    return {
      code: "MISSION_PILOT_READY",
      severity: "pass",
      message: "Assigned pilot passes readiness for mission approval and dispatch",
      source: "pilot",
      relatedPilotId: pilotId,
      relatedPilotReasonCodes: pilotReasonCodes,
    };
  }

  private mapMissionRiskReason(
    result: MissionRiskResult,
    riskReasonCodes: string[],
  ): MissionReadinessReason {
    if (result === "fail") {
      return {
        code: "MISSION_RISK_FAILED",
        severity: "fail",
        message: "Mission risk assessment fails and blocks approval or dispatch",
        source: "risk",
        relatedRiskReasonCodes: riskReasonCodes,
      };
    }

    if (result === "warning") {
      return {
        code: "MISSION_RISK_WARNING",
        severity: "warning",
        message: "Mission risk assessment requires explicit review before approval or dispatch",
        source: "risk",
        relatedRiskReasonCodes: riskReasonCodes,
      };
    }

    return {
      code: "MISSION_RISK_READY",
      severity: "pass",
      message: "Mission risk assessment passes for planning",
      source: "risk",
      relatedRiskReasonCodes: riskReasonCodes,
    };
  }

  private buildMissionReadiness(params: {
    missionId: string;
    platformId: string | null;
    pilotId: string | null;
    reasons: MissionReadinessReason[];
    platformReadiness: MissionReadinessCheck["platformReadiness"];
    pilotReadiness: MissionReadinessCheck["pilotReadiness"];
    missionRisk: MissionReadinessCheck["missionRisk"];
  }): MissionReadinessCheck {
    const result = this.getMissionReadinessResult(params.reasons);

    return {
      missionId: params.missionId,
      platformId: params.platformId,
      pilotId: params.pilotId,
      result,
      gate: {
        result,
        blocksApproval: result === "fail",
        blocksDispatch: result === "fail",
        requiresReview: result === "warning",
      },
      reasons: params.reasons,
      platformReadiness: params.platformReadiness,
      pilotReadiness: params.pilotReadiness,
      missionRisk: params.missionRisk,
    };
  }

  private getMissionReadinessResult(
    reasons: MissionReadinessReason[],
  ): MissionReadinessResult {
    if (reasons.some((reason) => reason.severity === "fail")) {
      return "fail";
    }

    if (reasons.some((reason) => reason.severity === "warning")) {
      return "warning";
    }

    return "pass";
  }
}
