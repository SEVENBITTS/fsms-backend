export type ExternalOverlayKind =
  | "weather"
  | "crewed_traffic"
  | "drone_traffic"
  | "area_conflict";

export type ExternalOverlaySeverity = "info" | "caution" | "critical";

export interface ExternalOverlaySource {
  provider: string;
  sourceType: string;
  sourceRecordId: string | null;
}

export interface ExternalOverlayPointGeometry {
  type: "point";
  lat: number;
  lng: number;
  altitudeMslFt: number | null;
}

export interface ExternalOverlayCircleGeometry {
  type: "circle";
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  altitudeFloorFt: number | null;
  altitudeCeilingFt: number | null;
}

export interface ExternalOverlayPolygonGeometry {
  type: "polygon";
  points: Array<{
    lat: number;
    lng: number;
  }>;
  centroidLat: number;
  centroidLng: number;
  altitudeFloorFt: number | null;
  altitudeCeilingFt: number | null;
}

export type ExternalOverlayGeometry =
  | ExternalOverlayPointGeometry
  | ExternalOverlayCircleGeometry
  | ExternalOverlayPolygonGeometry;

export interface WeatherOverlayMetadata {
  windSpeedKnots: number;
  windDirectionDegrees: number;
  temperatureC: number;
  precipitation:
    | "none"
    | "drizzle"
    | "rain"
    | "snow"
    | "hail"
    | "mixed";
}

export interface CrewedTrafficOverlayMetadata {
  trafficId: string;
  callsign: string | null;
  trackSource: string;
  aircraftCategory: string | null;
  verticalRateFpm: number | null;
}

export interface DroneTrafficOverlayMetadata {
  trafficId: string;
  trackSource: string;
  vehicleType: string | null;
  operatorReference: string | null;
  verticalRateFpm: number | null;
}

export interface AreaConflictOverlayMetadata {
  areaId: string;
  label: string;
  areaType: string;
  description: string | null;
}

export interface ExternalOverlay {
  id: string;
  missionId: string;
  kind: ExternalOverlayKind;
  source: ExternalOverlaySource;
  observedAt: string;
  validFrom: string | null;
  validTo: string | null;
  geometry: ExternalOverlayGeometry;
  headingDegrees: number | null;
  speedKnots: number | null;
  severity: ExternalOverlaySeverity | null;
  confidence: number | null;
  freshnessSeconds: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWeatherExternalOverlayInput {
  kind: "weather";
  source: {
    provider: string;
    sourceType: string;
    sourceRecordId?: string | null;
  };
  observedAt: string;
  validFrom?: string | null;
  validTo?: string | null;
  geometry: {
    type: "point";
    lat: number;
    lng: number;
    altitudeMslFt?: number | null;
  };
  severity?: ExternalOverlaySeverity | null;
  confidence?: number | null;
  freshnessSeconds?: number | null;
  metadata: WeatherOverlayMetadata;
}

export interface CreateCrewedTrafficExternalOverlayInput {
  kind: "crewed_traffic";
  source: {
    provider: string;
    sourceType: string;
    sourceRecordId?: string | null;
  };
  observedAt: string;
  validFrom?: string | null;
  validTo?: string | null;
  geometry: {
    type: "point";
    lat: number;
    lng: number;
    altitudeMslFt?: number | null;
  };
  headingDegrees?: number | null;
  speedKnots?: number | null;
  severity?: ExternalOverlaySeverity | null;
  confidence?: number | null;
  freshnessSeconds?: number | null;
  metadata: CrewedTrafficOverlayMetadata;
}

export interface CreateDroneTrafficExternalOverlayInput {
  kind: "drone_traffic";
  source: {
    provider: string;
    sourceType: string;
    sourceRecordId?: string | null;
  };
  observedAt: string;
  validFrom?: string | null;
  validTo?: string | null;
  geometry: {
    type: "point";
    lat: number;
    lng: number;
    altitudeMslFt?: number | null;
  };
  headingDegrees?: number | null;
  speedKnots?: number | null;
  severity?: ExternalOverlaySeverity | null;
  confidence?: number | null;
  freshnessSeconds?: number | null;
  metadata: DroneTrafficOverlayMetadata;
}

export interface CreateAreaConflictExternalOverlayInput {
  kind: "area_conflict";
  source: {
    provider: string;
    sourceType: string;
    sourceRecordId?: string | null;
  };
  observedAt: string;
  validFrom?: string | null;
  validTo?: string | null;
  geometry:
    | {
        type: "circle";
        centerLat: number;
        centerLng: number;
        radiusMeters: number;
        altitudeFloorFt?: number | null;
        altitudeCeilingFt?: number | null;
      }
    | {
        type: "polygon";
        points: Array<{
          lat: number;
          lng: number;
        }>;
        altitudeFloorFt?: number | null;
        altitudeCeilingFt?: number | null;
      };
  severity?: ExternalOverlaySeverity | null;
  confidence?: number | null;
  freshnessSeconds?: number | null;
  metadata: AreaConflictOverlayMetadata;
}

export interface ListExternalOverlaysFilters {
  kind?: ExternalOverlayKind;
}
