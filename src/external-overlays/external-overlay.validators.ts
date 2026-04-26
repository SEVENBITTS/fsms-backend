import type {
  CreateAreaConflictExternalOverlayInput,
  CreateCrewedTrafficExternalOverlayInput,
  CreateDroneTrafficExternalOverlayInput,
  NormalizeAreaOverlayRefreshStatus,
  CreateWeatherExternalOverlayInput,
  ExternalOverlaySeverity,
  NormalizeAreaOverlaySourcesInput,
} from "./external-overlay.types";

const SEVERITIES: ExternalOverlaySeverity[] = ["info", "caution", "critical"];
const PRECIPITATION = ["none", "drizzle", "rain", "snow", "hail", "mixed"];
const AREA_SOURCE_TYPES = [
  "danger_area",
  "temporary_danger_area",
  "notam_restriction",
] as const;
const AREA_REFRESH_STATUSES: NormalizeAreaOverlayRefreshStatus[] = [
  "fresh",
  "stale",
  "partial",
  "failed",
];

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

const dmsToDecimal = (
  degrees: number,
  minutes: number,
  seconds: number,
  hemisphere: string,
): number => {
  const absolute = degrees + minutes / 60 + seconds / 3600;
  return hemisphere === "S" || hemisphere === "W" ? -absolute : absolute;
};

const parseAviationCoordinate = (
  value: string,
  fieldName: string,
): number => {
  const normalized = value.trim().toUpperCase();

  const compactDmsMatch = normalized.match(
    /^(\d{2,3})(\d{2})(\d{2})?([NSEW])$/,
  );
  if (compactDmsMatch) {
    const [, degreeText, minuteText, secondText, hemisphere] = compactDmsMatch;
    const degrees = Number(degreeText);
    const minutes = Number(minuteText);
    const seconds = secondText ? Number(secondText) : 0;
    return dmsToDecimal(degrees, minutes, seconds, hemisphere);
  }

  const separatedDmsMatch = normalized.match(
    /^(\d{2,3})[:\s](\d{2})(?:[:\s](\d{2}))?([NSEW])$/,
  );
  if (separatedDmsMatch) {
    const [, degreeText, minuteText, secondText, hemisphere] = separatedDmsMatch;
    const degrees = Number(degreeText);
    const minutes = Number(minuteText);
    const seconds = secondText ? Number(secondText) : 0;
    return dmsToDecimal(degrees, minutes, seconds, hemisphere);
  }

  throw new Error(
    `${fieldName} must be a valid number or aviation coordinate (DDMMN, DDDMMW, DDMMSSN, DDDMMSSW)`,
  );
};

const requiredCoordinate = (value: unknown, fieldName: string): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return parseAviationCoordinate(value, fieldName);
  }

  throw new Error(
    `${fieldName} must be a valid number or aviation coordinate (DDMMN, DDDMMW, DDMMSSN, DDDMMSSW)`,
  );
};

const normalizeAreaGeometry = (
  geometryInput: unknown,
  fieldPrefix: string,
): CreateAreaConflictExternalOverlayInput["geometry"] => {
  if (!geometryInput || typeof geometryInput !== "object") {
    throw new Error(`${fieldPrefix} is required`);
  }

  const candidate = geometryInput as Record<string, any>;
  const geometryType = requiredString(
    candidate.type,
    `${fieldPrefix}.type`,
  ).toLowerCase();

  if (geometryType === "circle") {
    return {
      type: "circle",
      centerLat: requiredCoordinate(
        candidate.centerLat,
        `${fieldPrefix}.centerLat`,
      ),
      centerLng: requiredCoordinate(
        candidate.centerLng,
        `${fieldPrefix}.centerLng`,
      ),
      radiusMeters: requiredNumber(
        candidate.radiusMeters,
        `${fieldPrefix}.radiusMeters`,
      ),
      altitudeFloorFt: optionalNumber(
        candidate.altitudeFloorFt,
        `${fieldPrefix}.altitudeFloorFt`,
      ),
      altitudeCeilingFt: optionalNumber(
        candidate.altitudeCeilingFt,
        `${fieldPrefix}.altitudeCeilingFt`,
      ),
    };
  }

  if (geometryType === "polygon") {
    if (!Array.isArray(candidate.points) || candidate.points.length < 3) {
      throw new Error(`${fieldPrefix}.points must contain at least three points`);
    }

    return {
      type: "polygon",
      points: candidate.points.map((point: unknown, index: number) => {
        if (!point || typeof point !== "object") {
          throw new Error(`${fieldPrefix}.points[${index}] must be an object`);
        }

        const value = point as Record<string, unknown>;
        return {
          lat: requiredCoordinate(value.lat, `${fieldPrefix}.points[${index}].lat`),
          lng: requiredCoordinate(value.lng, `${fieldPrefix}.points[${index}].lng`),
        };
      }),
      altitudeFloorFt: optionalNumber(
        candidate.altitudeFloorFt,
        `${fieldPrefix}.altitudeFloorFt`,
      ),
      altitudeCeilingFt: optionalNumber(
        candidate.altitudeCeilingFt,
        `${fieldPrefix}.altitudeCeilingFt`,
      ),
    };
  }

  throw new Error(`${fieldPrefix}.type must be 'circle' or 'polygon'`);
};

const parseQLineIndex = (
  input: unknown,
  fieldPrefix: string,
): { centerLat: number; centerLng: number; radiusNm: number } => {
  if (!input || typeof input !== "object") {
    throw new Error(`${fieldPrefix} must be an object`);
  }

  const candidate = input as Record<string, unknown>;
  return {
    centerLat: requiredCoordinate(candidate.centerLat, `${fieldPrefix}.centerLat`),
    centerLng: requiredCoordinate(candidate.centerLng, `${fieldPrefix}.centerLng`),
    radiusNm: requiredNumber(candidate.radiusNm, `${fieldPrefix}.radiusNm`),
  };
};

const qLineIndexToCircleGeometry = (
  qLineIndex: { centerLat: number; centerLng: number; radiusNm: number },
  altitudeFloorFt: unknown,
  altitudeCeilingFt: unknown,
  fieldPrefix: string,
): CreateAreaConflictExternalOverlayInput["geometry"] => ({
  type: "circle",
  centerLat: qLineIndex.centerLat,
  centerLng: qLineIndex.centerLng,
  radiusMeters: qLineIndex.radiusNm * 1852,
  altitudeFloorFt: optionalNumber(altitudeFloorFt, `${fieldPrefix}.altitudeFloorFt`),
  altitudeCeilingFt: optionalNumber(
    altitudeCeilingFt,
    `${fieldPrefix}.altitudeCeilingFt`,
  ),
});

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
      lat: requiredCoordinate(candidate.geometry.lat, "geometry.lat"),
      lng: requiredCoordinate(candidate.geometry.lng, "geometry.lng"),
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
      lat: requiredCoordinate(candidate.geometry.lat, "geometry.lat"),
      lng: requiredCoordinate(candidate.geometry.lng, "geometry.lng"),
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
      lat: requiredCoordinate(candidate.geometry.lat, "geometry.lat"),
      lng: requiredCoordinate(candidate.geometry.lng, "geometry.lng"),
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

export const validateCreateAreaConflictExternalOverlayInput = (
  input: unknown,
): CreateAreaConflictExternalOverlayInput => {
  if (!input || typeof input !== "object") {
    throw new Error("request body is required");
  }

  const candidate = input as Record<string, any>;
  if (candidate.kind !== "area_conflict") {
    throw new Error("kind must be 'area_conflict'");
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

  const geometry = normalizeAreaGeometry(candidate.geometry, "geometry");

  return {
    kind: "area_conflict",
    source: {
      provider: requiredString(candidate.source.provider, "source.provider"),
      sourceType: requiredString(candidate.source.sourceType, "source.sourceType"),
      sourceRecordId: optionalString(candidate.source.sourceRecordId),
    },
    observedAt: requiredTimestamp(candidate.observedAt, "observedAt"),
    validFrom: optionalTimestamp(candidate.validFrom, "validFrom"),
    validTo: optionalTimestamp(candidate.validTo, "validTo"),
    geometry,
    severity: optionalSeverity(candidate.severity),
    confidence: optionalNumber(candidate.confidence, "confidence"),
    freshnessSeconds:
      candidate.freshnessSeconds == null
        ? null
        : requiredNumber(candidate.freshnessSeconds, "freshnessSeconds"),
    metadata: {
      areaId: requiredString(candidate.metadata.areaId, "metadata.areaId"),
      label: requiredString(candidate.metadata.label, "metadata.label"),
      areaType: requiredString(candidate.metadata.areaType, "metadata.areaType"),
      description: optionalString(candidate.metadata.description),
      authorityName: optionalString(candidate.metadata.authorityName),
      notamNumber: optionalString(candidate.metadata.notamNumber),
      sourceReference: optionalString(candidate.metadata.sourceReference),
      notamGeometryContext:
        candidate.metadata.notamGeometryContext &&
        typeof candidate.metadata.notamGeometryContext === "object"
          ? (candidate.metadata.notamGeometryContext as CreateAreaConflictExternalOverlayInput["metadata"]["notamGeometryContext"])
          : null,
    },
  };
};

export const validateNormalizeAreaOverlaySourcesInput = (
  input: unknown,
): NormalizeAreaOverlaySourcesInput => {
  if (!input || typeof input !== "object") {
    throw new Error("request body is required");
  }

  const candidate = input as Record<string, unknown>;
  const refresh =
    candidate.refresh && typeof candidate.refresh === "object"
      ? (candidate.refresh as Record<string, unknown>)
      : null;
  const refreshStatus =
    refresh?.status == null
      ? "fresh"
      : requiredString(refresh.status, "refresh.status").toLowerCase();

  if (
    !AREA_REFRESH_STATUSES.includes(
      refreshStatus as NormalizeAreaOverlayRefreshStatus,
    )
  ) {
    throw new Error(
      "refresh.status must be one of: fresh, stale, partial, failed",
    );
  }

  if (!Array.isArray(candidate.records)) {
    throw new Error("records must be an array");
  }

  if (candidate.records.length === 0 && refreshStatus !== "failed") {
    throw new Error("records must be a non-empty array unless refresh.status is 'failed'");
  }

  return {
    records: candidate.records.map((record, index) => {
      if (!record || typeof record !== "object") {
        throw new Error(`records[${index}] must be an object`);
      }

      const value = record as Record<string, any>;
      if (!value.source || typeof value.source !== "object") {
        throw new Error(`records[${index}].source is required`);
      }
      if (!value.area || typeof value.area !== "object") {
        throw new Error(`records[${index}].area is required`);
      }
      const sourceType = requiredString(
        value.source.sourceType,
        `records[${index}].source.sourceType`,
      ).toLowerCase();
      if (
        !AREA_SOURCE_TYPES.includes(
          sourceType as (typeof AREA_SOURCE_TYPES)[number],
        )
      ) {
        throw new Error(
          `records[${index}].source.sourceType must be one of: danger_area, temporary_danger_area, notam_restriction`,
        );
      }

      const areaType = requiredString(
        value.area.areaType,
        `records[${index}].area.areaType`,
      ).toLowerCase();
      if (
        !AREA_SOURCE_TYPES.includes(
          areaType as (typeof AREA_SOURCE_TYPES)[number],
        )
      ) {
        throw new Error(
          `records[${index}].area.areaType must be one of: danger_area, temporary_danger_area, notam_restriction`,
        );
      }

      const qLineIndex =
        value.notamGeometry &&
        typeof value.notamGeometry === "object" &&
        (value.notamGeometry as Record<string, unknown>).qLine
          ? parseQLineIndex(
              (value.notamGeometry as Record<string, unknown>).qLine,
              `records[${index}].notamGeometry.qLine`,
            )
          : null;

      const eFieldGeometry =
        value.notamGeometry &&
        typeof value.notamGeometry === "object" &&
        (value.notamGeometry as Record<string, unknown>).eFieldGeometry
          ? normalizeAreaGeometry(
              (value.notamGeometry as Record<string, unknown>).eFieldGeometry,
              `records[${index}].notamGeometry.eFieldGeometry`,
            )
          : null;

      const selectedGeometry =
        eFieldGeometry ??
        (value.geometry
          ? normalizeAreaGeometry(value.geometry, `records[${index}].geometry`)
          : qLineIndex
            ? qLineIndexToCircleGeometry(
                qLineIndex,
                value.altitudeFloorFt,
                value.altitudeCeilingFt,
                `records[${index}].notamGeometry.qLine`,
              )
            : null);

      if (!selectedGeometry) {
        throw new Error(
          `records[${index}].geometry is required unless records[${index}].notamGeometry.qLine is provided`,
        );
      }

      const geometrySource =
        eFieldGeometry != null
          ? "e_field"
          : qLineIndex != null && value.geometry == null
            ? "q_line"
            : "provided_geometry";

      const normalized = validateCreateAreaConflictExternalOverlayInput({
        kind: "area_conflict",
        source: {
          provider: value.source.provider,
          sourceType,
          sourceRecordId: value.source.sourceRecordId,
        },
        observedAt: value.observedAt,
        validFrom: value.validFrom,
        validTo: value.validTo,
        geometry: selectedGeometry,
        severity: value.severity,
        confidence: value.confidence,
        freshnessSeconds: value.freshnessSeconds,
        metadata: {
          areaId: value.area.areaId,
          label: value.area.label,
          areaType,
          description: value.area.description,
          authorityName: value.area.authorityName,
          notamNumber: value.area.notamNumber,
          sourceReference: value.area.sourceReference,
          notamGeometryContext: {
            geometrySource,
            qLineIndex,
          },
        },
      });

      return {
        source: {
          provider: normalized.source.provider,
          sourceType: normalized.source.sourceType as
            | "danger_area"
            | "temporary_danger_area"
            | "notam_restriction",
          sourceRecordId: normalized.source.sourceRecordId,
        },
        observedAt: normalized.observedAt,
        validFrom: normalized.validFrom,
        validTo: normalized.validTo,
        geometry: normalized.geometry,
        severity: normalized.severity,
        confidence: normalized.confidence,
        freshnessSeconds: normalized.freshnessSeconds,
        area: {
          areaId: normalized.metadata.areaId,
          label: normalized.metadata.label,
          areaType: normalized.metadata.areaType as
            | "danger_area"
            | "temporary_danger_area"
            | "notam_restriction",
          description: normalized.metadata.description ?? null,
          authorityName: normalized.metadata.authorityName ?? null,
          notamNumber: normalized.metadata.notamNumber ?? null,
          sourceReference: normalized.metadata.sourceReference ?? null,
          notamGeometryContext: normalized.metadata.notamGeometryContext ?? null,
        },
      };
    }),
    refresh: {
      status: refreshStatus as NormalizeAreaOverlayRefreshStatus,
    },
  };
};
