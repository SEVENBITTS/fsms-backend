import { randomUUID } from "crypto";
import type { Pool } from "pg";
import { ExternalOverlayRepository } from "../external-overlays/external-overlay.repository";
import type {
  CrewedTrafficOverlayMetadata,
  DroneTrafficOverlayMetadata,
  ExternalOverlay,
  WeatherOverlayMetadata,
} from "../external-overlays/external-overlay.types";
import { MissionRepository } from "../missions/mission.repository";
import { MissionTelemetryRepository } from "../missions/mission-telemetry.repository";
import type { MissionTelemetryRow } from "../missions/mission-telemetry.types";
import type {
  MissionTrafficConflictAssessmentResult,
  TrafficConflictAssessmentItem,
  TrafficConflictReferencePoint,
  TrafficConflictSeverity,
  TrafficConflictStatus,
} from "./traffic-conflict-assessment.types";

const FEET_PER_METER = 3.28084;
const EARTH_RADIUS_M = 6371000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

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

const round = (value: number | null): number | null =>
  value == null || Number.isNaN(value) ? null : Math.round(value);

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

const buildExplanation = (
  overlay: ExternalOverlay,
  lateralDistanceMeters: number | null,
  altitudeDeltaFt: number | null,
  weatherReason: string | null,
): string => {
  const base =
    overlay.kind === "drone_traffic"
      ? "Drone traffic proximity candidate"
      : "Crewed traffic proximity candidate";
  const lateral =
    lateralDistanceMeters == null ? "unknown lateral distance" : `${round(lateralDistanceMeters)} m lateral separation`;
  const vertical =
    altitudeDeltaFt == null ? "unknown vertical separation" : `${round(altitudeDeltaFt)} ft vertical separation`;

  return weatherReason
    ? `${base}: ${lateral}, ${vertical}, ${weatherReason}.`
    : `${base}: ${lateral}, ${vertical}.`;
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
        .filter(isTrafficOverlay)
        .map((overlay): TrafficConflictAssessmentItem | null => {
          const lateralDistanceMeters =
            referenceLat == null ||
            referenceLng == null ||
            overlay.geometry?.lat == null ||
            overlay.geometry?.lng == null
              ? null
              : haversineMeters(
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

          const observedAt = Date.parse(overlay.observedAt);
          const referenceTime = Date.parse(referenceTimestamp);
          const timeDeltaSeconds =
            Number.isFinite(observedAt) && Number.isFinite(referenceTime)
              ? Math.abs(referenceTime - observedAt) / 1000
              : null;
          const severity = escalateSeverity(
            classification.severity,
            weather.steps,
          );
          const overlayLabel = trafficLabel(overlay);

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
            explanation: buildExplanation(
              overlay,
              lateralDistanceMeters,
              altitudeDeltaFt,
              weather.reason,
            ),
            overlayLabel,
            relatedSource: { ...overlay.source },
            metrics: {
              lateralDistanceMeters: round(lateralDistanceMeters),
              altitudeDeltaFt: round(altitudeDeltaFt),
              timeDeltaSeconds: round(timeDeltaSeconds),
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
