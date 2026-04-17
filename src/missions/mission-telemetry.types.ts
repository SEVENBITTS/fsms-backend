export type MissionStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "active"
  | "completed"
  | "cancelled";

export interface MissionSummary {
  id: string;
  status: MissionStatus;
}

export interface MissionTelemetryInput {
  timestamp: string;
  lat?: number;
  lng?: number;
  altitudeM?: number;
  speedMps?: number;
  headingDeg?: number;
  progressPct?: number;
  payload?: Record<string, unknown>;
}

export interface MissionTelemetryBatchInput {
  records: MissionTelemetryInput[];
}

export interface MissionTelemetryRow {
  id: string;
  missionId: string;
  recordedAt: Date;
  lat: number | null;
  lng: number | null;
  altitudeM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  progressPct: number | null;
  payload: Record<string, unknown>;
  createdAt?: Date;
}

export interface RecordMissionTelemetryResult {
  missionId: string;
  accepted: number;
}

export interface MissionRepository {
  findById(missionId: string): Promise<MissionSummary | null>;
}

export interface LatestMissionTelemetryResult {
  missionId: string;
  telemetry: {
    timestamp: string;
    lat: number | null;
    lng: number | null;
    altitudeM: number | null;
    speedMps: number | null;
    headingDeg: number | null;
    progressPct: number | null;
    payload: Record<string, unknown>;
  } | null;
}

export interface MissionTelemetryRecordDto {
  timestamp: string;
  lat: number | null;
  lng: number | null;
  altitudeM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  progressPct: number | null;
  payload: Record<string, unknown>;
}

export interface MissionTelemetryHistoryResult {
  missionId: string;
  records: MissionTelemetryRecordDto[];
}

export interface MissionTelemetryHistoryQuery {
  from?: string;
  to?: string;
  limit?: number;
}

export interface MissionTelemetryRangeQuery {
  from?: Date;
  to?: Date;
}
