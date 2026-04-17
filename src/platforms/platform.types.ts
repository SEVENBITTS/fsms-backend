export type PlatformStatus =
  | "active"
  | "inactive"
  | "maintenance_due"
  | "grounded"
  | "retired";

export type MaintenanceScheduleStatus = "active" | "inactive";

export interface CreatePlatformInput {
  name?: string;
  registration?: string | null;
  platformType?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  status?: PlatformStatus;
  totalFlightHours?: number;
  notes?: string | null;
}

export interface Platform {
  id: string;
  name: string;
  registration: string | null;
  platformType: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  status: PlatformStatus;
  totalFlightHours: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaintenanceScheduleInput {
  taskName?: string;
  description?: string | null;
  intervalDays?: number | null;
  intervalFlightHours?: number | null;
  nextDueAt?: string | null;
  nextDueFlightHours?: number | null;
  status?: MaintenanceScheduleStatus;
}

export interface MaintenanceSchedule {
  id: string;
  platformId: string;
  taskName: string;
  description: string | null;
  intervalDays: number | null;
  intervalFlightHours: number | null;
  lastCompletedAt: string | null;
  lastCompletedFlightHours: number | null;
  nextDueAt: string | null;
  nextDueFlightHours: number | null;
  status: MaintenanceScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaintenanceRecordInput {
  scheduleId?: string | null;
  taskName?: string;
  completedAt?: string;
  completedBy?: string;
  completedFlightHours?: number | null;
  notes?: string | null;
  evidenceRef?: string | null;
}

export interface MaintenanceRecord {
  id: string;
  platformId: string;
  scheduleId: string | null;
  taskName: string;
  completedAt: string;
  completedBy: string;
  completedFlightHours: number | null;
  notes: string | null;
  evidenceRef: string | null;
  createdAt: string;
}

export interface PlatformMaintenanceStatus {
  platform: Platform;
  effectiveStatus: PlatformStatus;
  dueSchedules: MaintenanceSchedule[];
  upcomingSchedules: MaintenanceSchedule[];
  latestRecords: MaintenanceRecord[];
}
