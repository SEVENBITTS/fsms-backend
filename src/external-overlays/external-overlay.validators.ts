import type {
  CreateCrewedTrafficExternalOverlayInput,
  CreateDroneTrafficExternalOverlayInput,
  CreateWeatherExternalOverlayInput,
  ExternalOverlaySeverity,
} from "./external-overlay.types";

const SEVERITIES: ExternalOverlaySeverity[] = ["info", "caution", "critical"];
const PRECIPITATION = ["none", "drizzle", "rain", "snow", "hail", "mixed"];

const requiredString = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
};

const optionalString = (value: unknown): string | null => {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Optional string fields must be strings when provided");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const requiredNumber = (value: unknown, fieldName: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  return value;
};

const optionalNumber = (value: unknown, fieldName: string): number | null => {
  if (value == null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a valid number when provided`);
  }

  return value;
};

const requiredTimestamp = (value: unknown, fieldName: string): string => {
  const normalized = requiredString(value, fieldName);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new Error(`${fieldName} must be a valid ISO timestamp`);
  }

  return normalized;
};

const optionalTimestamp = (value: unknown, fieldName: string): string | null => {
  if (value == null) {
    return null;
  }

  const normalized = requiredString(value, fieldName);

  if (Number.isNaN(Date.parse(normalized))) {
    throw new Error(`${fieldName} must be a valid ISO timestamp`);
  }

  return normalized;
};

const optionalSeverity = (value: unknown): ExternalOverlaySeverity | null => {
  if (value == null) {
    return null;
  }

  const normalized = requiredString(value, "severity").toLowerCase();
  if (!SEVERITIES.includes(normalized as ExternalOverlaySeverity)) {
    throw new Error("severity must be one of: info, caution, critical");
  }

  return normalized as ExternalOverlaySeverity;
};

export const validateCreateWeatherExternalOverlayInput = (
  input: unknown,
): CreateWeatherExternalOverlayInput => {
  if (!input || typeof input !== "object") {
    throw new Error("request body is required");
  }

  const candidate = input as Record<string, any>;
  if (candidate.kind !== "weather") {
    throw new Error("kind must be 'weather'");
  }

  if (!candidate.source || typeof candidate.source !== "object") {
    throw new Error("source is required");
  }

  if (!candidate.geometry || typeof candidate.geometry !== "object") {
    throw new Error("geometry is required");
  }

  if (!candidate.metadata || typeof candidate.metadata !== "object") {
    throw new Error("metadata is required");
  }

  const precipitation = requiredString(
    candidate.metadata.precipitation,
    "metadata.precipitation",
  ).toLowerCase();
  if (!PRECIPITATION.includes(precipitation)) {
    throw new Error(
      "metadata.precipitation must be one of: none, drizzle, rain, snow, hail, mixed",
    );
  }

  if (candidate.geometry.type !== "point") {
    throw new Error("geometry.type must be 'point'");
  }

  return {
    kind: "weather",
    source: {
      provider: requiredString(candidate.source.provider, "source.provider"),
      sourceType: requiredString(candidate.source.sourceType, "source.sourceType"),
      sourceRecordId: optionalString(candidate.source.sourceRecordId),
    },
    observedAt: requiredTimestamp(candidate.observedAt, "observedAt"),
    validFrom: optionalTimestamp(candidate.validFrom, "validFrom"),
    validTo: optionalTimestamp(candidate.validTo, "validTo"),
    geometry: {
      type: "point",
      lat: requiredNumber(candidate.geometry.lat, "geometry.lat"),
      lng: requiredNumber(candidate.geometry.lng, "geometry.lng"),
      altitudeMslFt: optionalNumber(
        candidate.geometry.altitudeMslFt,
        "geometry.altitudeMslFt",
      ),
    },
    severity: optionalSeverity(candidate.severity),
    confidence: optionalNumber(candidate.confidence, "confidence"),
    freshnessSeconds:
      candidate.freshnessSeconds == null
        ? null
        : requiredNumber(candidate.freshnessSeconds, "freshnessSeconds"),
    metadata: {
      windSpeedKnots: requiredNumber(
        candidate.metadata.windSpeedKnots,
        "metadata.windSpeedKnots",
      ),
      windDirectionDegrees: requiredNumber(
        candidate.metadata.windDirectionDegrees,
        "metadata.windDirectionDegrees",
      ),
      temperatureC: requiredNumber(
        candidate.metadata.temperatureC,
        "metadata.temperatureC",
      ),
      precipitation: precipitation as CreateWeatherExternalOverlayInput["metadata"]["precipitation"],
    },
  };
};

export const validateCreateCrewedTrafficExternalOverlayInput = (
  input: unknown,
): CreateCrewedTrafficExternalOverlayInput => {
  if (!input || typeof input !== "object") {
    throw new Error("request body is required");
  }

  const candidate = input as Record<string, any>;
  if (candidate.kind !== "crewed_traffic") {
    throw new Error("kind must be 'crewed_traffic'");
  }

  if (!candidate.source || typeof candidate.source !== "object") {
    throw new Error("source is required");
  }

  if (!candidate.geometry || typeof candidate.geometry !== "object") {
    throw new Error("geometry is required");
  }

  if (!candidate.metadata || typeof candidate.metadata !== "object") {
    throw new Error("metadata is required");
  }

  if (candidate.geometry.type !== "point") {
    throw new Error("geometry.type must be 'point'");
  }

  return {
    kind: "crewed_traffic",
    source: {
      provider: requiredString(candidate.source.provider, "source.provider"),
      sourceType: requiredString(candidate.source.sourceType, "source.sourceType"),
      sourceRecordId: optionalString(candidate.source.sourceRecordId),
    },
    observedAt: requiredTimestamp(candidate.observedAt, "observedAt"),
    validFrom: optionalTimestamp(candidate.validFrom, "validFrom"),
    validTo: optionalTimestamp(candidate.validTo, "validTo"),
    geometry: {
      type: "point",
      lat: requiredNumber(candidate.geometry.lat, "geometry.lat"),
      lng: requiredNumber(candidate.geometry.lng, "geometry.lng"),
      altitudeMslFt: optionalNumber(
        candidate.geometry.altitudeMslFt,
        "geometry.altitudeMslFt",
      ),
    },
    headingDegrees: optionalNumber(candidate.headingDegrees, "headingDegrees"),
    speedKnots: optionalNumber(candidate.speedKnots, "speedKnots"),
    severity: optionalSeverity(candidate.severity),
    confidence: optionalNumber(candidate.confidence, "confidence"),
    freshnessSeconds:
      candidate.freshnessSeconds == null
        ? null
        : requiredNumber(candidate.freshnessSeconds, "freshnessSeconds"),
    metadata: {
      trafficId: requiredString(candidate.metadata.trafficId, "metadata.trafficId"),
      callsign: optionalString(candidate.metadata.callsign),
      trackSource: requiredString(
        candidate.metadata.trackSource,
        "metadata.trackSource",
      ),
      aircraftCategory: optionalString(candidate.metadata.aircraftCategory),
      verticalRateFpm: optionalNumber(
        candidate.metadata.verticalRateFpm,
        "metadata.verticalRateFpm",
      ),
    },
  };
};

export const validateCreateDroneTrafficExternalOverlayInput = (
  input: unknown,
): CreateDroneTrafficExternalOverlayInput => {
  if (!input || typeof input !== "object") {
    throw new Error("request body is required");
  }

  const candidate = input as Record<string, any>;
  if (candidate.kind !== "drone_traffic") {
    throw new Error("kind must be 'drone_traffic'");
  }

  if (!candidate.source || typeof candidate.source !== "object") {
    throw new Error("source is required");
  }

  if (!candidate.geometry || typeof candidate.geometry !== "object") {
    throw new Error("geometry is required");
  }

  if (!candidate.metadata || typeof candidate.metadata !== "object") {
    throw new Error("metadata is required");
  }

  if (candidate.geometry.type !== "point") {
    throw new Error("geometry.type must be 'point'");
  }

  return {
    kind: "drone_traffic",
    source: {
      provider: requiredString(candidate.source.provider, "source.provider"),
      sourceType: requiredString(candidate.source.sourceType, "source.sourceType"),
      sourceRecordId: optionalString(candidate.source.sourceRecordId),
    },
    observedAt: requiredTimestamp(candidate.observedAt, "observedAt"),
    validFrom: optionalTimestamp(candidate.validFrom, "validFrom"),
    validTo: optionalTimestamp(candidate.validTo, "validTo"),
    geometry: {
      type: "point",
      lat: requiredNumber(candidate.geometry.lat, "geometry.lat"),
      lng: requiredNumber(candidate.geometry.lng, "geometry.lng"),
      altitudeMslFt: optionalNumber(
        candidate.geometry.altitudeMslFt,
        "geometry.altitudeMslFt",
      ),
    },
    headingDegrees: optionalNumber(candidate.headingDegrees, "headingDegrees"),
    speedKnots: optionalNumber(candidate.speedKnots, "speedKnots"),
    severity: optionalSeverity(candidate.severity),
    confidence: optionalNumber(candidate.confidence, "confidence"),
    freshnessSeconds:
      candidate.freshnessSeconds == null
        ? null
        : requiredNumber(candidate.freshnessSeconds, "freshnessSeconds"),
    metadata: {
      trafficId: requiredString(candidate.metadata.trafficId, "metadata.trafficId"),
      trackSource: requiredString(
        candidate.metadata.trackSource,
        "metadata.trackSource",
      ),
      vehicleType: optionalString(candidate.metadata.vehicleType),
      operatorReference: optionalString(candidate.metadata.operatorReference),
      verticalRateFpm: optionalNumber(
        candidate.metadata.verticalRateFpm,
        "metadata.verticalRateFpm",
      ),
    },
  };
};
