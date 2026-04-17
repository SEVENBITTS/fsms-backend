import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  MaintenanceRecord,
  MaintenanceSchedule,
  Platform,
} from "./platform.types";

interface PlatformRow extends QueryResultRow {
  id: string;
  name: string;
  registration: string | null;
  platform_type: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  status: Platform["status"];
  total_flight_hours: string | number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MaintenanceScheduleRow extends QueryResultRow {
  id: string;
  platform_id: string;
  task_name: string;
  description: string | null;
  interval_days: number | null;
  interval_flight_hours: string | number | null;
  last_completed_at: Date | null;
  last_completed_flight_hours: string | number | null;
  next_due_at: Date | null;
  next_due_flight_hours: string | number | null;
  status: MaintenanceSchedule["status"];
  created_at: Date;
  updated_at: Date;
}

interface MaintenanceRecordRow extends QueryResultRow {
  id: string;
  platform_id: string;
  schedule_id: string | null;
  task_name: string;
  completed_at: Date;
  completed_by: string;
  completed_flight_hours: string | number | null;
  notes: string | null;
  evidence_ref: string | null;
  created_at: Date;
}

type CreatePlatformRow = Omit<Platform, "id" | "createdAt" | "updatedAt">;

type CreateScheduleRow = {
  platformId: string;
  taskName: string;
  description: string | null;
  intervalDays: number | null;
  intervalFlightHours: number | null;
  nextDueAt: Date | null;
  nextDueFlightHours: number | null;
  status: MaintenanceSchedule["status"];
};

type CreateRecordRow = {
  platformId: string;
  scheduleId: string | null;
  taskName: string;
  completedAt: Date;
  completedBy: string;
  completedFlightHours: number | null;
  notes: string | null;
  evidenceRef: string | null;
};

const numberOrNull = (value: string | number | null): number | null =>
  value === null ? null : Number(value);

const toPlatform = (row: PlatformRow): Platform => ({
  id: row.id,
  name: row.name,
  registration: row.registration,
  platformType: row.platform_type,
  manufacturer: row.manufacturer,
  model: row.model,
  serialNumber: row.serial_number,
  status: row.status,
  totalFlightHours: Number(row.total_flight_hours),
  notes: row.notes,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toSchedule = (row: MaintenanceScheduleRow): MaintenanceSchedule => ({
  id: row.id,
  platformId: row.platform_id,
  taskName: row.task_name,
  description: row.description,
  intervalDays: row.interval_days,
  intervalFlightHours: numberOrNull(row.interval_flight_hours),
  lastCompletedAt: row.last_completed_at?.toISOString() ?? null,
  lastCompletedFlightHours: numberOrNull(row.last_completed_flight_hours),
  nextDueAt: row.next_due_at?.toISOString() ?? null,
  nextDueFlightHours: numberOrNull(row.next_due_flight_hours),
  status: row.status,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toRecord = (row: MaintenanceRecordRow): MaintenanceRecord => ({
  id: row.id,
  platformId: row.platform_id,
  scheduleId: row.schedule_id,
  taskName: row.task_name,
  completedAt: row.completed_at.toISOString(),
  completedBy: row.completed_by,
  completedFlightHours: numberOrNull(row.completed_flight_hours),
  notes: row.notes,
  evidenceRef: row.evidence_ref,
  createdAt: row.created_at.toISOString(),
});

export class PlatformRepository {
  async insertPlatform(tx: PoolClient, input: CreatePlatformRow): Promise<Platform> {
    const result = await tx.query<PlatformRow>(
      `
      insert into platforms (
        id,
        name,
        registration,
        platform_type,
        manufacturer,
        model,
        serial_number,
        status,
        total_flight_hours,
        notes
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning *
      `,
      [
        randomUUID(),
        input.name,
        input.registration,
        input.platformType,
        input.manufacturer,
        input.model,
        input.serialNumber,
        input.status,
        input.totalFlightHours,
        input.notes,
      ],
    );

    return toPlatform(result.rows[0]);
  }

  async getPlatformById(
    tx: PoolClient,
    platformId: string,
  ): Promise<Platform | null> {
    const result = await tx.query<PlatformRow>(
      `
      select *
      from platforms
      where id = $1
      `,
      [platformId],
    );

    return result.rows[0] ? toPlatform(result.rows[0]) : null;
  }

  async insertMaintenanceSchedule(
    tx: PoolClient,
    input: CreateScheduleRow,
  ): Promise<MaintenanceSchedule> {
    const result = await tx.query<MaintenanceScheduleRow>(
      `
      insert into maintenance_schedules (
        id,
        platform_id,
        task_name,
        description,
        interval_days,
        interval_flight_hours,
        next_due_at,
        next_due_flight_hours,
        status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
      `,
      [
        randomUUID(),
        input.platformId,
        input.taskName,
        input.description,
        input.intervalDays,
        input.intervalFlightHours,
        input.nextDueAt,
        input.nextDueFlightHours,
        input.status,
      ],
    );

    return toSchedule(result.rows[0]);
  }

  async getMaintenanceScheduleById(
    tx: PoolClient,
    platformId: string,
    scheduleId: string,
  ): Promise<MaintenanceSchedule | null> {
    const result = await tx.query<MaintenanceScheduleRow>(
      `
      select *
      from maintenance_schedules
      where platform_id = $1
        and id = $2
      `,
      [platformId, scheduleId],
    );

    return result.rows[0] ? toSchedule(result.rows[0]) : null;
  }

  async listMaintenanceSchedules(
    tx: PoolClient,
    platformId: string,
  ): Promise<MaintenanceSchedule[]> {
    const result = await tx.query<MaintenanceScheduleRow>(
      `
      select *
      from maintenance_schedules
      where platform_id = $1
      order by created_at asc, id asc
      `,
      [platformId],
    );

    return result.rows.map(toSchedule);
  }

  async insertMaintenanceRecord(
    tx: PoolClient,
    input: CreateRecordRow,
  ): Promise<MaintenanceRecord> {
    const result = await tx.query<MaintenanceRecordRow>(
      `
      insert into maintenance_records (
        id,
        platform_id,
        schedule_id,
        task_name,
        completed_at,
        completed_by,
        completed_flight_hours,
        notes,
        evidence_ref
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
      `,
      [
        randomUUID(),
        input.platformId,
        input.scheduleId,
        input.taskName,
        input.completedAt,
        input.completedBy,
        input.completedFlightHours,
        input.notes,
        input.evidenceRef,
      ],
    );

    return toRecord(result.rows[0]);
  }

  async updateScheduleCompletion(
    tx: PoolClient,
    params: {
      scheduleId: string;
      completedAt: Date;
      completedFlightHours: number | null;
      nextDueAt: Date | null;
      nextDueFlightHours: number | null;
    },
  ): Promise<MaintenanceSchedule> {
    const result = await tx.query<MaintenanceScheduleRow>(
      `
      update maintenance_schedules
      set
        last_completed_at = $2,
        last_completed_flight_hours = $3,
        next_due_at = $4,
        next_due_flight_hours = $5,
        updated_at = now()
      where id = $1
      returning *
      `,
      [
        params.scheduleId,
        params.completedAt,
        params.completedFlightHours,
        params.nextDueAt,
        params.nextDueFlightHours,
      ],
    );

    return toSchedule(result.rows[0]);
  }

  async listMaintenanceRecords(
    tx: PoolClient,
    platformId: string,
    limit = 20,
  ): Promise<MaintenanceRecord[]> {
    const result = await tx.query<MaintenanceRecordRow>(
      `
      select *
      from maintenance_records
      where platform_id = $1
      order by completed_at desc, created_at desc, id desc
      limit $2
      `,
      [platformId, limit],
    );

    return result.rows.map(toRecord);
  }
}
