import type { Pool } from "pg";
import {
  MaintenanceScheduleNotFoundError,
  PlatformNotFoundError,
  PlatformValidationError,
} from "./platform.errors";
import { PlatformRepository } from "./platform.repository";
import type {
  AircraftTypeSpec,
  CreateAircraftTypeSpecInput,
  CreateMaintenanceRecordInput,
  CreateMaintenanceScheduleInput,
  CreatePlatformInput,
  MaintenanceSchedule,
  PlatformMaintenanceStatus,
  PlatformReadinessCheck,
  PlatformReadinessReason,
  PlatformReadinessResult,
} from "./platform.types";
import {
  validateCreateAircraftTypeSpecInput,
  validateCreateMaintenanceRecordInput,
  validateCreateMaintenanceScheduleInput,
  validateCreatePlatformInput,
} from "./platform.validators";

export class PlatformService {
  constructor(
    private readonly pool: Pool,
    private readonly platformRepository: PlatformRepository,
  ) {}

  async createPlatform(input: CreatePlatformInput) {
    const validated = validateCreatePlatformInput(input);
    const client = await this.pool.connect();

    try {
      return await this.platformRepository.insertPlatform(client, validated);
    } finally {
      client.release();
    }
  }

  async createAircraftTypeSpec(
    input: CreateAircraftTypeSpecInput,
  ): Promise<AircraftTypeSpec> {
    const validated = validateCreateAircraftTypeSpecInput(input);
    const client = await this.pool.connect();

    try {
      return await this.platformRepository.insertAircraftTypeSpec(
        client,
        validated,
      );
    } finally {
      client.release();
    }
  }

  async listAircraftTypeSpecs(): Promise<AircraftTypeSpec[]> {
    const client = await this.pool.connect();

    try {
      return await this.platformRepository.listAircraftTypeSpecs(client);
    } finally {
      client.release();
    }
  }

  async getPlatform(platformId: string) {
    const client = await this.pool.connect();

    try {
      const platform = await this.platformRepository.getPlatformById(
        client,
        platformId,
      );

      if (!platform) {
        throw new PlatformNotFoundError(platformId);
      }

      return platform;
    } finally {
      client.release();
    }
  }

  async createMaintenanceSchedule(
    platformId: string,
    input: CreateMaintenanceScheduleInput,
  ) {
    const validated = validateCreateMaintenanceScheduleInput(input);
    const client = await this.pool.connect();

    try {
      const platform = await this.platformRepository.getPlatformById(
        client,
        platformId,
      );

      if (!platform) {
        throw new PlatformNotFoundError(platformId);
      }

      return await this.platformRepository.insertMaintenanceSchedule(client, {
        platformId,
        ...validated,
      });
    } finally {
      client.release();
    }
  }

  async createMaintenanceRecord(
    platformId: string,
    input: CreateMaintenanceRecordInput,
  ) {
    const validated = validateCreateMaintenanceRecordInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("begin");

      const platform = await this.platformRepository.getPlatformById(
        client,
        platformId,
      );

      if (!platform) {
        throw new PlatformNotFoundError(platformId);
      }

      let schedule: MaintenanceSchedule | null = null;

      if (validated.scheduleId) {
        schedule = await this.platformRepository.getMaintenanceScheduleById(
          client,
          platformId,
          validated.scheduleId,
        );

        if (!schedule) {
          throw new MaintenanceScheduleNotFoundError(validated.scheduleId);
        }
      }

      const taskName = validated.taskName ?? schedule?.taskName;

      if (!taskName) {
        throw new PlatformValidationError(
          "taskName is required when scheduleId is not provided",
        );
      }

      const record = await this.platformRepository.insertMaintenanceRecord(
        client,
        {
          platformId,
          scheduleId: validated.scheduleId,
          taskName,
          completedAt: validated.completedAt,
          completedBy: validated.completedBy,
          completedFlightHours: validated.completedFlightHours,
          notes: validated.notes,
          evidenceRef: validated.evidenceRef,
        },
      );

      if (schedule) {
        await this.platformRepository.updateScheduleCompletion(client, {
          scheduleId: schedule.id,
          completedAt: validated.completedAt,
          completedFlightHours: validated.completedFlightHours,
          nextDueAt: this.computeNextDueAt(schedule, validated.completedAt),
          nextDueFlightHours: this.computeNextDueFlightHours(
            schedule,
            validated.completedFlightHours,
          ),
        });
      }

      await client.query("commit");
      return record;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async getMaintenanceStatus(
    platformId: string,
  ): Promise<PlatformMaintenanceStatus> {
    const client = await this.pool.connect();

    try {
      const platform = await this.platformRepository.getPlatformById(
        client,
        platformId,
      );

      if (!platform) {
        throw new PlatformNotFoundError(platformId);
      }

      const schedules = await this.platformRepository.listMaintenanceSchedules(
        client,
        platformId,
      );
      const latestRecords = await this.platformRepository.listMaintenanceRecords(
        client,
        platformId,
      );

      const dueSchedules = schedules.filter((schedule) =>
        this.isScheduleDue(schedule, platform.totalFlightHours),
      );
      const upcomingSchedules = schedules.filter(
        (schedule) => !dueSchedules.some((item) => item.id === schedule.id),
      );

      return {
        platform,
        effectiveStatus:
          platform.status === "active" && dueSchedules.length > 0
            ? "maintenance_due"
            : platform.status,
        dueSchedules,
        upcomingSchedules,
        latestRecords,
      };
    } finally {
      client.release();
    }
  }

  async checkPlatformReadiness(
    platformId: string,
  ): Promise<PlatformReadinessCheck> {
    const maintenanceStatus = await this.getMaintenanceStatus(platformId);
    const reasons = this.buildReadinessReasons(maintenanceStatus);

    return {
      platformId,
      result: this.getReadinessResult(reasons),
      reasons,
      maintenanceStatus,
    };
  }

  private computeNextDueAt(
    schedule: MaintenanceSchedule,
    completedAt: Date,
  ): Date | null {
    if (schedule.intervalDays === null) {
      return schedule.nextDueAt ? new Date(schedule.nextDueAt) : null;
    }

    const next = new Date(completedAt);
    next.setUTCDate(next.getUTCDate() + schedule.intervalDays);
    return next;
  }

  private computeNextDueFlightHours(
    schedule: MaintenanceSchedule,
    completedFlightHours: number | null,
  ): number | null {
    if (
      schedule.intervalFlightHours === null ||
      completedFlightHours === null
    ) {
      return schedule.nextDueFlightHours;
    }

    return completedFlightHours + schedule.intervalFlightHours;
  }

  private isScheduleDue(
    schedule: MaintenanceSchedule,
    platformTotalFlightHours: number,
  ): boolean {
    if (schedule.status !== "active") {
      return false;
    }

    const dueByDate =
      schedule.nextDueAt !== null && new Date(schedule.nextDueAt) <= new Date();
    const dueByHours =
      schedule.nextDueFlightHours !== null &&
      schedule.nextDueFlightHours <= platformTotalFlightHours;

    return dueByDate || dueByHours;
  }

  private buildReadinessReasons(
    maintenanceStatus: PlatformMaintenanceStatus,
  ): PlatformReadinessReason[] {
    const { platform, dueSchedules } = maintenanceStatus;

    if (platform.status === "grounded") {
      return [
        {
          code: "PLATFORM_GROUNDED",
          severity: "fail",
          message: "Platform is grounded and is not fit for mission use",
        },
      ];
    }

    if (platform.status === "retired") {
      return [
        {
          code: "PLATFORM_RETIRED",
          severity: "fail",
          message: "Platform is retired and is not fit for mission use",
        },
      ];
    }

    const reasons: PlatformReadinessReason[] = [];

    if (platform.status === "inactive") {
      reasons.push({
        code: "PLATFORM_INACTIVE",
        severity: "warning",
        message: "Platform is inactive and requires review before mission use",
      });
    }

    if (platform.status === "maintenance_due" || dueSchedules.length > 0) {
      reasons.push({
        code: "PLATFORM_MAINTENANCE_DUE",
        severity: "warning",
        message: "Platform has overdue maintenance requiring review before mission use",
        relatedScheduleIds: dueSchedules.map((schedule) => schedule.id),
      });
    }

    if (reasons.length === 0) {
      reasons.push({
        code: "PLATFORM_ACTIVE",
        severity: "pass",
        message: "Platform is active with no overdue maintenance",
      });
    }

    return reasons;
  }

  private getReadinessResult(
    reasons: PlatformReadinessReason[],
  ): PlatformReadinessResult {
    if (reasons.some((reason) => reason.severity === "fail")) {
      return "fail";
    }

    if (reasons.some((reason) => reason.severity === "warning")) {
      return "warning";
    }

    return "pass";
  }
}
