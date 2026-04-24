import { randomUUID } from "crypto";
import type { Pool } from "pg";
import { ExternalOverlayRepository } from "../external-overlays/external-overlay.repository";
import type {
  AreaConflictOverlayMetadata,
  CrewedTrafficOverlayMetadata,
  DroneTrafficOverlayMetadata,
  ExternalOverlay,
  ExternalOverlayCircleGeometry,
  ExternalOverlayPolygonGeometry,
  WeatherOverlayMetadata,
} from "../external-overlays/external-overlay.types";
import { MissionRepository } from "../missions/mission.repository";
import { MissionTelemetryRepository } from "../missions/mission-telemetry.repository";
import type { MissionTelemetryRow } from "../missions/mission-telemetry.types";
import type {
  MissionTrafficConflictAssessmentResult,
  TrafficConflictAssessmentItem,
  TrafficConflictResolutionGuidance,
  TrafficConflictReferencePoint,
  TrafficConflictSeverity,
  TrafficConflictStatus,
} from "./traffic-conflict-assessment.types";

const FEET_PER_METER = 3.28084;
const EARTH_RADIUS_M = 6371000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const haversineMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const bearingDegrees = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const startLat = toRadians(lat1);
  const targetLat = toRadians(lat2);
  const deltaLng = toRadians(lng2 - lng1);
  const y = Math.sin(deltaLng) * Math.cos(targetLat);
  const x =
    Math.cos(startLat) * Math.sin(targetLat) -
    Math.sin(startLat) * Math.cos(targetLat) * Math.cos(deltaLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

const round = (value: number | null): number | null =>
  value == null || Number.isNaN(value) ? null : Math.round(value);

const pointInPolygon = (
  lat: number,
  lng: number,
  points: Array<{ lat: number; lng: number }>,
): boolean => {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const xi = points[index].lng;
    const yi = points[index].lat;
    const xj = points[previous].lng;
    const yj = points[previous].lat;

    const intersects =
      yi > lat !== yj > lat &&
      lng <
        ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const projectMeters = (
  originLat: number,
  originLng: number,
  lat: number,
  lng: number,
): { x: number; y: number } => ({
  x:
    toRadians(lng - originLng) *
    EARTH_RADIUS_M *
    Math.cos(toRadians((lat + originLat) / 2)),
  y: toRadians(lat - originLat) * EARTH_RADIUS_M,
});

const unprojectMeters = (
  originLat: number,
  originLng: number,
  x: number,
  y: number,
): { lat: number; lng: number } => ({
  lat: originLat + toDegrees(y / EARTH_RADIUS_M),
  lng:
    originLng +
    toDegrees(
      x /
        (EARTH_RADIUS_M * Math.cos(toRadians(originLat || Number.EPSILON))),
    ),
});

const nearestPointOnSegment = (
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): { x: number; y: number; distance: number } => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    const distance = Math.hypot(point.x - start.x, point.y - start.y);
    return { x: start.x, y: start.y, distance };
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    ),
  );
  const nearest = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  return {
    ...nearest,
    distance: Math.hypot(point.x - nearest.x, point.y - nearest.y),
  };
};

const nearestBoundaryForPolygon = (
  referenceLat: number,
  referenceLng: number,
  geometry: ExternalOverlayPolygonGeometry,
): {
  rangeMeters: number;
  bearingDegrees: number | null;
  insideArea: boolean;
} => {
  const insideArea = pointInPolygon(referenceLat, referenceLng, geometry.points);
  const referencePoint = { x: 0, y: 0 };
  let best:
    | {
        x: number;
        y: number;
        distance: number;
      }
    | null = null;

  for (let index = 0; index < geometry.points.length; index += 1) {
    const startPoint = geometry.points[index];
    const endPoint = geometry.points[(index + 1) % geometry.points.length];
    const start = projectMeters(
      referenceLat,
      referenceLng,
      startPoint.lat,
      startPoint.lng,
    );
    const end = projectMeters(referenceLat, referenceLng, endPoint.lat, endPoint.lng);
    const candidate = nearestPointOnSegment(referencePoint, start, end);

    if (!best || candidate.distance < best.distance) {
      best = candidate;
    }
  }

  if (!best) {
    return { rangeMeters: 0, bearingDegrees: null, insideArea };
  }

  const boundaryPoint = unprojectMeters(
    referenceLat,
    referenceLng,
    best.x,
    best.y,
  );

  return {
    rangeMeters: best.distance,
    bearingDegrees: best.distance === 0
      ? null
      : bearingDegrees(referenceLat, referenceLng, boundaryPoint.lat, boundaryPoint.lng),
    insideArea,
  };
};

const nearestBoundaryForCircle = (
  referenceLat: number,
  referenceLng: number,
  geometry: ExternalOverlayCircleGeometry,
): {
  rangeMeters: number;
  bearingDegrees: number | null;
  insideArea: boolean;
} => {
  const distanceToCenter = haversineMeters(
    referenceLat,
    referenceLng,
    geometry.centerLat,
    geometry.centerLng,
  );
  const insideArea = distanceToCenter <= geometry.radiusMeters;
  const rangeMeters = Math.abs(distanceToCenter - geometry.radiusMeters);
  const bearingToCenter =
    distanceToCenter === 0
      ? null
      : bearingDegrees(
          referenceLat,
          referenceLng,
          geometry.centerLat,
          geometry.centerLng,
        );

  return {
    rangeMeters,
    bearingDegrees: bearingToCenter,
    insideArea,
  };
};

const severityRank = (severity: TrafficConflictSeverity): number => {
  if (severity === "critical") return 3;
  if (severity === "caution") return 2;
  return 1;
};

const escalateSeverity = (
  severity: TrafficConflictSeverity,
  steps: number,
): TrafficConflictSeverity => {
  const ranked = Math.min(severityRank(severity) + steps, 3);

  if (ranked >= 3) return "critical";
  if (ranked === 2) return "caution";
  return "info";
};

const trafficLabel = (overlay: ExternalOverlay): string => {
  if (overlay.kind === "area_conflict") {
    const metadata = overlay.metadata as unknown as AreaConflictOverlayMetadata;
    return metadata.label ?? metadata.areaId ?? "Area conflict";
  }

  if (overlay.kind === "crewed_traffic") {
    const metadata = overlay.metadata as unknown as CrewedTrafficOverlayMetadata;
    return metadata.callsign ?? metadata.trafficId ?? "Crewed traffic";
  }

  const metadata = overlay.metadata as unknown as DroneTrafficOverlayMetadata;
  return metadata.operatorReference ?? metadata.trafficId ?? "Drone traffic";
};

const weatherModifier = (
  weatherOverlay: ExternalOverlay | null,
): { steps: number; reason: string | null } => {
  if (!weatherOverlay || weatherOverlay.kind !== "weather") {
    return { steps: 0, reason: null };
  }

  const metadata = weatherOverlay.metadata as unknown as WeatherOverlayMetadata;
  const wind = Number(metadata.windSpeedKnots ?? 0);
  const precipitation = String(metadata.precipitation ?? "none");

  if (wind >= 35 || ["hail", "snow", "mixed"].includes(precipitation)) {
    return {
      steps: 1,
      reason: `weather escalation: ${wind} kt wind and ${precipitation} precipitation`,
    };
  }

  if (wind >= 25 || precipitation !== "none") {
    return {
      steps: 1,
      reason: `weather context: ${wind} kt wind and ${precipitation} precipitation`,
    };
  }

  return { steps: 0, reason: null };
};

const activeWeatherOverlayAt = (
  overlays: ExternalOverlay[],
  referenceTimestamp: string,
): ExternalOverlay | null => {
  const referenceTime = Date.parse(referenceTimestamp);

  if (!Number.isFinite(referenceTime)) {
    return overlays.find((overlay) => overlay.kind === "weather") ?? null;
  }

  return (
    overlays
      .filter((overlay) => overlay.kind === "weather")
      .map((overlay) => {
        const observedAt = Date.parse(overlay.observedAt);
        const validFrom = overlay.validFrom ? Date.parse(overlay.validFrom) : observedAt;
        const validTo = overlay.validTo ? Date.parse(overlay.validTo) : null;
        const active =
          Number.isFinite(validFrom) &&
          referenceTime >= validFrom &&
          (validTo == null || referenceTime <= validTo);
        const distance = Number.isFinite(observedAt)
          ? Math.abs(referenceTime - observedAt)
          : Number.POSITIVE_INFINITY;

        return { overlay, active, distance };
      })
      .sort((left, right) => {
        if (left.active !== right.active) {
          return left.active ? -1 : 1;
        }

        return left.distance - right.distance;
      })[0]?.overlay ?? null
  );
};

const classifyTrafficConflict = (
  overlay: ExternalOverlay,
  lateralDistanceMeters: number | null,
  altitudeDeltaFt: number | null,
): { status: TrafficConflictStatus; severity: TrafficConflictSeverity } | null => {
  if (lateralDistanceMeters == null) {
    return null;
  }

  const altitude = altitudeDeltaFt ?? Number.POSITIVE_INFINITY;

  if (overlay.kind === "drone_traffic") {
    if (lateralDistanceMeters <= 250 && altitude <= 200) {
      return { status: "conflict_candidate", severity: "critical" };
    }
    if (lateralDistanceMeters <= 600 && altitude <= 400) {
      return { status: "conflict_candidate", severity: "caution" };
    }
    if (lateralDistanceMeters <= 1200 && altitude <= 800) {
      return { status: "monitor", severity: "info" };
    }
    return null;
  }

  if (lateralDistanceMeters <= 800 && altitude <= 500) {
    return { status: "conflict_candidate", severity: "critical" };
  }
  if (lateralDistanceMeters <= 2000 && altitude <= 1000) {
    return { status: "conflict_candidate", severity: "caution" };
  }
  if (lateralDistanceMeters <= 4000 && altitude <= 2000) {
    return { status: "monitor", severity: "info" };
  }

  return null;
};

const deriveAreaVerticalContext = (
  referenceAltitudeFt: number | null,
  floorFt: number | null,
  ceilingFt: number | null,
): TrafficConflictAssessmentItem["verticalContext"] => {
  if (floorFt == null && ceilingFt == null) {
    return {
      referenceAltitudeFt,
      altitudeFloorFt: null,
      altitudeCeilingFt: null,
      relation: "not_applicable",
    };
  }

  if (referenceAltitudeFt == null) {
    return {
      referenceAltitudeFt: null,
      altitudeFloorFt: floorFt,
      altitudeCeilingFt: ceilingFt,
      relation: "unknown",
    };
  }
  if (floorFt != null && referenceAltitudeFt < floorFt) {
    return {
      referenceAltitudeFt,
      altitudeFloorFt: floorFt,
      altitudeCeilingFt: ceilingFt,
      relation: "below_band",
    };
  }
  if (ceilingFt != null && referenceAltitudeFt > ceilingFt) {
    return {
      referenceAltitudeFt,
      altitudeFloorFt: floorFt,
      altitudeCeilingFt: ceilingFt,
      relation: "above_band",
    };
  }

  return {
    referenceAltitudeFt,
    altitudeFloorFt: floorFt,
    altitudeCeilingFt: ceilingFt,
    relation: "inside_band",
  };
};

const deriveAreaTemporalContext = (
  referenceTimestamp: string,
  validFrom: string | null,
  validTo: string | null,
): TrafficConflictAssessmentItem["temporalContext"] => {
  if (!validFrom && !validTo) {
    return {
      referenceTimestamp,
      validFrom: null,
      validTo: null,
      relation: "not_applicable",
    };
  }

  const referenceTime = Date.parse(referenceTimestamp);
  const validFromTime = validFrom ? Date.parse(validFrom) : null;
  const validToTime = validTo ? Date.parse(validTo) : null;

  if (
    !Number.isFinite(referenceTime) ||
    (validFromTime != null && !Number.isFinite(validFromTime)) ||
    (validToTime != null && !Number.isFinite(validToTime))
  ) {
    return {
      referenceTimestamp,
      validFrom,
      validTo,
      relation: "unknown",
    };
  }

  if (validFromTime != null && referenceTime < validFromTime) {
    return {
      referenceTimestamp,
      validFrom,
      validTo,
      relation: "before_window",
    };
  }

  if (validToTime != null && referenceTime > validToTime) {
    return {
      referenceTimestamp,
      validFrom,
      validTo,
      relation: "after_window",
    };
  }

  return {
    referenceTimestamp,
    validFrom,
    validTo,
    relation: "inside_window",
  };
};

const classifyAreaConflict = (
  boundaryDistanceMeters: number | null,
  insideArea: boolean,
): { status: TrafficConflictStatus; severity: TrafficConflictSeverity } | null => {
  if (insideArea) {
    return { status: "conflict_candidate", severity: "critical" };
  }
  if (boundaryDistanceMeters == null) {
    return null;
  }
  if (boundaryDistanceMeters <= 250) {
    return { status: "conflict_candidate", severity: "critical" };
  }
  if (boundaryDistanceMeters <= 750) {
    return { status: "conflict_candidate", severity: "caution" };
  }
  if (boundaryDistanceMeters <= 1500) {
    return { status: "monitor", severity: "info" };
  }

  return null;
};

const buildExplanation = (
  overlay: ExternalOverlay,
  lateralDistanceMeters: number | null,
  altitudeDeltaFt: number | null,
  bearingToOverlayDegrees: number | null,
  weatherReason: string | null,
): string => {
  const base =
    overlay.kind === "area_conflict"
      ? "Area conflict proximity candidate"
      : overlay.kind === "drone_traffic"
      ? "Drone traffic proximity candidate"
      : "Crewed traffic proximity candidate";
  const lateral =
    lateralDistanceMeters == null ? "unknown lateral distance" : `${round(lateralDistanceMeters)} m lateral separation`;
  const vertical =
    altitudeDeltaFt == null ? "unknown vertical separation" : `${round(altitudeDeltaFt)} ft vertical separation`;
  const bearing =
    bearingToOverlayDegrees == null
      ? "unknown bearing"
      : `${round(bearingToOverlayDegrees)}° bearing from mission reference`;

  return weatherReason
    ? `${base}: ${lateral}, ${vertical}, ${bearing}, ${weatherReason}.`
    : `${base}: ${lateral}, ${vertical}, ${bearing}.`;
};

const buildResolutionGuidance = (
  overlayKind: TrafficConflictAssessmentItem["overlayKind"],
  severity: TrafficConflictSeverity,
  status: TrafficConflictStatus,
  insideArea: boolean | null,
  explanation: string,
): TrafficConflictResolutionGuidance => {
  if (severity === "critical") {
    const recommendedAction =
      overlayKind === "area_conflict" && insideArea
        ? "Hold or suspend mission progress and escalate before continuing"
        : "Review immediately and prepare deconfliction, abort, or diversion options";

    return {
      mode: "decision_support",
      urgency: "immediate_review",
      recommendedAction,
      authorityRequired: "supervisor",
      pilotInstructionStatus: "not_a_pilot_command",
      rationale: `${explanation} This is decision-support guidance and does not directly command the pilot or aircraft.`,
    };
  }

  if (severity === "caution" || status === "conflict_candidate") {
    return {
      mode: "decision_support",
      urgency: "review",
      recommendedAction: "Review conflict context and confirm separation remains acceptable",
      authorityRequired: "operator",
      pilotInstructionStatus: "not_a_pilot_command",
      rationale: `${explanation} Operator review is recommended before continuing without further action.`,
    };
  }

  return {
    mode: "decision_support",
    urgency: "monitor",
    recommendedAction: "Monitor conflict context",
    authorityRequired: "operator",
    pilotInstructionStatus: "not_a_pilot_command",
    rationale: `${explanation} Continue monitoring unless the operational picture changes.`,
  };
};

const toReferenceTelemetry = (
  row: MissionTelemetryRow | null,
): TrafficConflictReferencePoint | null =>
  row
    ? {
        timestamp: row.recordedAt.toISOString(),
        lat: row.lat,
        lng: row.lng,
        altitudeM: row.altitudeM,
        speedMps: row.speedMps,
        headingDeg: row.headingDeg,
        progressPct: row.progressPct,
      }
    : null;

const isTrafficOverlay = (
  overlay: ExternalOverlay,
): overlay is ExternalOverlay & {
  kind: "crewed_traffic" | "drone_traffic";
} => overlay.kind === "crewed_traffic" || overlay.kind === "drone_traffic";

const isAreaConflictOverlay = (
  overlay: ExternalOverlay,
): overlay is ExternalOverlay & {
  kind: "area_conflict";
} => overlay.kind === "area_conflict";

export class TrafficConflictAssessmentService {
  constructor(
    private readonly pool: Pool,
    private readonly missionRepository: MissionRepository,
    private readonly missionTelemetryRepository: MissionTelemetryRepository,
    private readonly externalOverlayRepository: ExternalOverlayRepository,
  ) {}

  async assessMission(
    missionId: string,
  ): Promise<MissionTrafficConflictAssessmentResult> {
    const client = await this.pool.connect();

    try {
      await this.missionRepository.getById(client, missionId);

      const replay = await this.missionTelemetryRepository.findReplayByMissionId(
        missionId,
        client,
        {},
      );
      const latestTelemetry =
        replay.at(-1) ??
        (await this.missionTelemetryRepository.findLatestByMissionId(
          missionId,
          client,
        ));
      const overlays = await this.externalOverlayRepository.listForMission(
        client,
        missionId,
      );

      const referenceTimestamp =
        latestTelemetry?.recordedAt.toISOString() ?? new Date().toISOString();
      const assessedAt = new Date().toISOString();
      const relevantWeather = activeWeatherOverlayAt(overlays, referenceTimestamp);
      const weather = weatherModifier(relevantWeather);
      const referenceLat = latestTelemetry?.lat;
      const referenceLng = latestTelemetry?.lng;
      const referenceAltitudeFt =
        latestTelemetry?.altitudeM == null ? null : latestTelemetry.altitudeM * FEET_PER_METER;

      const conflicts = overlays
        .filter(
          (overlay): overlay is ExternalOverlay & {
            kind: "crewed_traffic" | "drone_traffic" | "area_conflict";
          } => isTrafficOverlay(overlay) || isAreaConflictOverlay(overlay),
        )
        .map((overlay): TrafficConflictAssessmentItem | null => {
          const overlayLabel = trafficLabel(overlay);
          const observedAt = Date.parse(overlay.observedAt);
          const referenceTime = Date.parse(referenceTimestamp);
          const timeDeltaSeconds =
            Number.isFinite(observedAt) && Number.isFinite(referenceTime)
              ? Math.abs(referenceTime - observedAt) / 1000
              : null;

          if (overlay.kind === "area_conflict") {
            const geometry = overlay.geometry;
            if (
              referenceLat == null ||
              referenceLng == null ||
              (geometry.type !== "circle" && geometry.type !== "polygon")
            ) {
              return null;
            }

            const altitudeFloorFt =
              geometry.type === "circle"
                ? geometry.altitudeFloorFt
                : geometry.altitudeFloorFt;
            const altitudeCeilingFt =
              geometry.type === "circle"
                ? geometry.altitudeCeilingFt
                : geometry.altitudeCeilingFt;
            const temporalContext = deriveAreaTemporalContext(
              referenceTimestamp,
              overlay.validFrom ?? null,
              overlay.validTo ?? null,
            );
            const verticalContext = deriveAreaVerticalContext(
              referenceAltitudeFt,
              altitudeFloorFt,
              altitudeCeilingFt,
            );

            if (
              temporalContext.relation === "before_window" ||
              temporalContext.relation === "after_window" ||
              verticalContext.relation === "below_band" ||
              verticalContext.relation === "above_band"
            ) {
              return null;
            }

            const geometryAssessment =
              geometry.type === "circle"
                ? nearestBoundaryForCircle(referenceLat, referenceLng, geometry)
                : nearestBoundaryForPolygon(referenceLat, referenceLng, geometry);
            const classification = classifyAreaConflict(
              geometryAssessment.rangeMeters,
              geometryAssessment.insideArea,
            );

            if (!classification) {
              return null;
            }

            const severity = escalateSeverity(
              overlay.severity ?? classification.severity,
              weather.steps,
            );
            const geometryLabel =
              geometry.type === "circle" ? "area circle" : "area polygon";
            const summary =
              classification.status === "conflict_candidate"
                ? `${overlayLabel} area conflict candidate`
                : `${overlayLabel} area monitor candidate`;
            const altitudeBandText =
              altitudeFloorFt != null || altitudeCeilingFt != null
                ? ` altitude band ${altitudeFloorFt ?? "surface"}-${altitudeCeilingFt ?? "open"} ft`
                : "";
            const verticalRelationText =
              verticalContext.relation === "inside_band"
                ? "mission reference altitude is inside the active altitude band"
                : verticalContext.relation === "unknown"
                  ? "mission reference altitude is unknown for altitude-band gating"
                  : "altitude band not applicable";
            const validityWindowText =
              overlay.validFrom != null || overlay.validTo != null
                ? ` active window ${overlay.validFrom ?? "open"}-${overlay.validTo ?? "open"}`
                : "";
            const temporalRelationText =
              temporalContext.relation === "inside_window"
                ? "mission reference time is inside the active restriction window"
                : temporalContext.relation === "unknown"
                  ? "mission reference time is unknown for validity-window gating"
                  : "validity window not applicable";
            const explanation = geometryAssessment.insideArea
              ? `Area conflict proximity candidate: mission reference is inside ${geometryLabel} ${overlayLabel}; nearest boundary ${round(geometryAssessment.rangeMeters)} m away, ${
                  geometryAssessment.bearingDegrees == null
                    ? "unknown bearing"
                    : `${round(geometryAssessment.bearingDegrees)}° bearing from mission reference`
                }, ${temporalRelationText}.${validityWindowText ? `${validityWindowText}.` : ""}${verticalRelationText ? ` ${verticalRelationText}.` : ""}${altitudeBandText ? `${altitudeBandText}.` : ""}${weather.reason ? ` ${weather.reason}.` : ""}`
              : `Area conflict proximity candidate: ${overlayLabel} boundary is ${round(
                  geometryAssessment.rangeMeters,
                )} m away at ${
                  geometryAssessment.bearingDegrees == null
                    ? "unknown bearing"
                    : `${round(geometryAssessment.bearingDegrees)}° bearing from mission reference`
                }, ${temporalRelationText}.${validityWindowText ? `${validityWindowText}.` : ""}${verticalRelationText ? ` ${verticalRelationText}.` : ""}${altitudeBandText ? `${altitudeBandText}.` : ""}${weather.reason ? ` ${weather.reason}.` : ""}`;

            const resolutionGuidance = buildResolutionGuidance(
              "area_conflict",
              severity,
              classification.status,
              geometryAssessment.insideArea,
              explanation,
            );

            return {
              id: randomUUID(),
              missionId,
              overlayId: overlay.id,
              overlayKind: "area_conflict",
              assessedAt,
              referenceTimestamp,
              overlayObservedAt: overlay.observedAt,
              status: classification.status,
              severity,
              summary,
              explanation,
              resolutionGuidance,
              overlayLabel,
              relatedSource: { ...overlay.source },
              measurementBasis: {
                referencePoint: "latest_telemetry",
                targetGeometry:
                  geometry.type === "circle" ? "overlay_circle" : "overlay_polygon",
                rangeRule: "nearest_boundary",
                bearingReference: "true_north",
              },
              temporalContext,
              verticalContext,
              metrics: {
                rangeMeters: round(geometryAssessment.rangeMeters),
                bearingDegrees: round(geometryAssessment.bearingDegrees),
                lateralDistanceMeters: round(geometryAssessment.rangeMeters),
                altitudeDeltaFt: null,
                timeDeltaSeconds: round(timeDeltaSeconds),
                insideArea: geometryAssessment.insideArea,
                overlayHeadingDegrees: null,
                overlaySpeedKnots: null,
              },
            };
          }

          if (overlay.geometry.type !== "point") {
            return null;
          }

          const lateralDistanceMeters =
            referenceLat == null ||
            referenceLng == null ||
            overlay.geometry.lat == null ||
            overlay.geometry.lng == null
              ? null
              : haversineMeters(
                  referenceLat,
                  referenceLng,
                  overlay.geometry.lat,
                  overlay.geometry.lng,
                );
          const bearingToOverlayDegrees =
            referenceLat == null ||
            referenceLng == null ||
            overlay.geometry.lat == null ||
            overlay.geometry.lng == null
              ? null
              : bearingDegrees(
                  referenceLat,
                  referenceLng,
                  overlay.geometry.lat,
                  overlay.geometry.lng,
                );

          const altitudeDeltaFt =
            referenceAltitudeFt == null || overlay.geometry.altitudeMslFt == null
              ? null
              : Math.abs(referenceAltitudeFt - overlay.geometry.altitudeMslFt);
          const classification = classifyTrafficConflict(
            overlay,
            lateralDistanceMeters,
            altitudeDeltaFt,
          );

          if (!classification) {
            return null;
          }

          const severity = escalateSeverity(
            classification.severity,
            weather.steps,
          );
          const explanation = buildExplanation(
            overlay,
            lateralDistanceMeters,
            altitudeDeltaFt,
            bearingToOverlayDegrees,
            weather.reason,
          );

          return {
            id: randomUUID(),
            missionId,
            overlayId: overlay.id,
            overlayKind: overlay.kind,
            assessedAt,
            referenceTimestamp,
            overlayObservedAt: overlay.observedAt,
            status: classification.status,
            severity,
            summary:
              classification.status === "conflict_candidate"
                ? `${overlayLabel} conflict candidate`
                : `${overlayLabel} monitor candidate`,
            explanation,
            resolutionGuidance: buildResolutionGuidance(
              overlay.kind,
              severity,
              classification.status,
              null,
              explanation,
            ),
            overlayLabel,
            relatedSource: { ...overlay.source },
            measurementBasis: {
              referencePoint: "latest_telemetry",
              targetGeometry: "overlay_point",
              rangeRule: "point_to_point",
              bearingReference: "true_north",
            },
            temporalContext: {
              referenceTimestamp,
              validFrom: null,
              validTo: null,
              relation: "not_applicable",
            },
            verticalContext: {
              referenceAltitudeFt,
              altitudeFloorFt: null,
              altitudeCeilingFt: null,
              relation: "not_applicable",
            },
            metrics: {
              rangeMeters: round(lateralDistanceMeters),
              bearingDegrees: round(bearingToOverlayDegrees),
              lateralDistanceMeters: round(lateralDistanceMeters),
              altitudeDeltaFt: round(altitudeDeltaFt),
              timeDeltaSeconds: round(timeDeltaSeconds),
              insideArea: null,
              overlayHeadingDegrees: overlay.headingDegrees,
              overlaySpeedKnots: overlay.speedKnots,
            },
          };
        })
        .filter(
          (item): item is TrafficConflictAssessmentItem => item !== null,
        )
        .sort((left, right) => {
          const severityDiff = severityRank(right.severity) - severityRank(left.severity);
          if (severityDiff !== 0) {
            return severityDiff;
          }

          const leftDistance = left.metrics.lateralDistanceMeters ?? Number.POSITIVE_INFINITY;
          const rightDistance =
            right.metrics.lateralDistanceMeters ?? Number.POSITIVE_INFINITY;

          return leftDistance - rightDistance;
        });

      return {
        missionId,
        assessedAt,
        reference: {
          replayPointCount: replay.length,
          telemetry: toReferenceTelemetry(latestTelemetry),
        },
        conflicts,
      };
    } finally {
      client.release();
    }
  }
}

