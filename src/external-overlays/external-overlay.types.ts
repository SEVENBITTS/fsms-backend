export type ExternalOverlayKind =
  | "weather"
  | "crewed_traffic"
  | "drone_traffic";

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

export type ExternalOverlayGeometry = ExternalOverlayPointGeometry;

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

export interface ListExternalOverlaysFilters {
  kind?: ExternalOverlayKind;
}
