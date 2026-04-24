import type { ExternalOverlayKind } from "../external-overlays/external-overlay.types";

export type TrafficConflictStatus = "monitor" | "conflict_candidate";

export type TrafficConflictSeverity = "info" | "caution" | "critical";

export type TrafficConflictGuidanceUrgency =
  | "monitor"
  | "review"
  | "immediate_review";

export type TrafficConflictGuidanceAuthority = "operator" | "supervisor";

export type TrafficConflictGuidanceActionCode =
  | "monitor_context"
  | "review_separation"
  | "prepare_deconfliction"
  | "hold_or_suspend";

export interface TrafficConflictResolutionGuidance {
  mode: "decision_support";
  urgency: TrafficConflictGuidanceUrgency;
  actionCode: TrafficConflictGuidanceActionCode;
  recommendedAction: string;
  prohibitedActions: string[];
  authorityRequired: TrafficConflictGuidanceAuthority;
  pilotInstructionStatus: "not_a_pilot_command";
  rationale: string;
}

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
  overlayKind: Extract<
    ExternalOverlayKind,
    "crewed_traffic" | "drone_traffic" | "area_conflict"
  >;
  assessedAt: string;
  referenceTimestamp: string;
  overlayObservedAt: string;
  status: TrafficConflictStatus;
  severity: TrafficConflictSeverity;
  summary: string;
  explanation: string;
  resolutionGuidance: TrafficConflictResolutionGuidance;
  overlayLabel: string;
  relatedSource: {
    provider: string;
    sourceType: string;
    sourceRecordId: string | null;
  };
  measurementBasis: {
    referencePoint: "latest_telemetry";
    targetGeometry: "overlay_point" | "overlay_circle" | "overlay_polygon";
    rangeRule: "point_to_point" | "nearest_boundary";
    bearingReference: "true_north";
  };
  temporalContext: {
    referenceTimestamp: string;
    validFrom: string | null;
    validTo: string | null;
    relation:
      | "not_applicable"
      | "unknown"
      | "before_window"
      | "inside_window"
      | "after_window";
  };
  verticalContext: {
    referenceAltitudeFt: number | null;
    altitudeFloorFt: number | null;
    altitudeCeilingFt: number | null;
    relation:
      | "not_applicable"
      | "unknown"
      | "below_band"
      | "inside_band"
      | "above_band";
  };
  metrics: {
    rangeMeters: number | null;
    bearingDegrees: number | null;
    lateralDistanceMeters: number | null;
    altitudeDeltaFt: number | null;
    timeDeltaSeconds: number | null;
    insideArea: boolean | null;
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
