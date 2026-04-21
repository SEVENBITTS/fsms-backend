import type { ExternalOverlayKind } from "../external-overlays/external-overlay.types";

export type TrafficConflictStatus = "monitor" | "conflict_candidate";

export type TrafficConflictSeverity = "info" | "caution" | "critical";

export interface TrafficConflictReferencePoint {
  timestamp: string;
  lat: number | null;
  lng: number | null;
  altitudeM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  progressPct: number | null;
}

export interface TrafficConflictAssessmentItem {
  id: string;
  missionId: string;
  overlayId: string;
  overlayKind: Extract<ExternalOverlayKind, "crewed_traffic" | "drone_traffic">;
  assessedAt: string;
  referenceTimestamp: string;
  overlayObservedAt: string;
  status: TrafficConflictStatus;
  severity: TrafficConflictSeverity;
  summary: string;
  explanation: string;
  overlayLabel: string;
  relatedSource: {
    provider: string;
    sourceType: string;
    sourceRecordId: string | null;
  };
  metrics: {
    lateralDistanceMeters: number | null;
    altitudeDeltaFt: number | null;
    timeDeltaSeconds: number | null;
    overlayHeadingDegrees: number | null;
    overlaySpeedKnots: number | null;
  };
}

export interface MissionTrafficConflictAssessmentResult {
  missionId: string;
  assessedAt: string;
  reference: {
    replayPointCount: number;
    telemetry: TrafficConflictReferencePoint | null;
  };
  conflicts: TrafficConflictAssessmentItem[];
}
