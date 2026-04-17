export interface MissionReplayQuery {
  from?: string;
  to?: string;
}

export interface ValidatedMissionReplayQuery {
  from?: Date;
  to?: Date;
}

export interface MissionReplayRecordDto {
  timestamp: string;
  lat: number | null;
  lng: number | null;
  altitudeM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  progressPct: number | null;
  payload: Record<string, unknown>;
}

export interface MissionReplayResult {
  missionId: string;
  replay: MissionReplayRecordDto[];
}
