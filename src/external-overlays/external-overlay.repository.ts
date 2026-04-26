import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
  CreateAreaConflictExternalOverlayInput,
  CreateCrewedTrafficExternalOverlayInput,
  CreateDroneTrafficExternalOverlayInput,
  CreateWeatherExternalOverlayInput,
  ExternalOverlay,
  ExternalOverlayKind,
  ListExternalOverlaysFilters,
} from "./external-overlay.types";

interface ExternalOverlayRow extends QueryResultRow {
  id: string;
  mission_id: string;
  overlay_kind: ExternalOverlayKind;
  source_provider: string;
  source_type: string;
  source_record_id: string | null;
  observed_at: Date;
  valid_from: Date | null;
  valid_to: Date | null;
  geometry_type: "point" | "circle" | "polygon";
  latitude: number | null;
  longitude: number | null;
  altitude_msl_ft: number | null;
  heading_degrees: number | null;
  speed_knots: number | null;
  severity: ExternalOverlay["severity"];
  confidence: number | null;
  freshness_seconds: number | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const polygonCentroid = (
  points: Array<{ lat: number; lng: number }>,
): { lat: number; lng: number } => {
  const total = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / points.length,
    lng: total.lng / points.length,
  };
};

const toExternalOverlay = (row: ExternalOverlayRow): ExternalOverlay => ({
  id: row.id,
  missionId: row.mission_id,
  kind: row.overlay_kind,
  source: {
    provider: row.source_provider,
    sourceType: row.source_type,
    sourceRecordId: row.source_record_id,
  },
  observedAt: row.observed_at.toISOString(),
  validFrom: row.valid_from ? row.valid_from.toISOString() : null,
  validTo: row.valid_to ? row.valid_to.toISOString() : null,
  geometry:
    row.geometry_type === "circle"
      ? {
          type: "circle",
          centerLat: Number(row.latitude),
          centerLng: Number(row.longitude),
          radiusMeters: Number((row.metadata as Record<string, unknown>).radiusMeters),
          altitudeFloorFt:
            typeof (row.metadata as Record<string, unknown>).altitudeFloorFt ===
            "number"
              ? Number((row.metadata as Record<string, unknown>).altitudeFloorFt)
              : null,
          altitudeCeilingFt:
            typeof (row.metadata as Record<string, unknown>).altitudeCeilingFt ===
            "number"
              ? Number((row.metadata as Record<string, unknown>).altitudeCeilingFt)
              : null,
        }
      : row.geometry_type === "polygon"
        ? {
            type: "polygon",
            points: Array.isArray((row.metadata as Record<string, unknown>).points)
              ? ((row.metadata as Record<string, unknown>).points as Array<Record<string, unknown>>).map(
                  (point) => ({
                    lat: Number(point.lat),
                    lng: Number(point.lng),
                  }),
                )
              : [],
            centroidLat: Number(row.latitude),
            centroidLng: Number(row.longitude),
            altitudeFloorFt:
              typeof (row.metadata as Record<string, unknown>).altitudeFloorFt ===
              "number"
                ? Number((row.metadata as Record<string, unknown>).altitudeFloorFt)
                : null,
            altitudeCeilingFt:
              typeof (row.metadata as Record<string, unknown>).altitudeCeilingFt ===
              "number"
                ? Number((row.metadata as Record<string, unknown>).altitudeCeilingFt)
                : null,
          }
        : {
            type: "point",
            lat: Number(row.latitude),
            lng: Number(row.longitude),
            altitudeMslFt:
              row.altitude_msl_ft == null ? null : Number(row.altitude_msl_ft),
          },
  headingDegrees:
    row.heading_degrees == null ? null : Number(row.heading_degrees),
  speedKnots: row.speed_knots == null ? null : Number(row.speed_knots),
  severity: row.severity,
  confidence: row.confidence == null ? null : Number(row.confidence),
  freshnessSeconds:
    row.freshness_seconds == null ? null : Number(row.freshness_seconds),
  metadata: row.metadata ?? {},
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class ExternalOverlayRepository {
  async missionExists(tx: PoolClient, missionId: string): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from missions
      where id = $1
      `,
      [missionId],
    );

    return result.rowCount === 1;
  }

  async insertWeatherOverlay(
    tx: PoolClient,
    missionId: string,
    input: CreateWeatherExternalOverlayInput,
  ): Promise<ExternalOverlay> {
    const result = await tx.query<ExternalOverlayRow>(
      `
      insert into mission_external_overlays (
        id,
        mission_id,
        overlay_kind,
        source_provider,
        source_type,
        source_record_id,
        observed_at,
        valid_from,
        valid_to,
        geometry_type,
        latitude,
        longitude,
        altitude_msl_ft,
        heading_degrees,
        speed_knots,
        severity,
        confidence,
        freshness_seconds,
        metadata
      )
      values (
        $1, $2, 'weather', $3, $4, $5, $6, $7, $8, 'point', $9, $10, $11, null, null, $12, $13, $14, $15::jsonb
      )
      returning *
      `,
      [
        randomUUID(),
        missionId,
        input.source.provider,
        input.source.sourceType,
        input.source.sourceRecordId,
        input.observedAt,
        input.validFrom,
        input.validTo,
        input.geometry.lat,
        input.geometry.lng,
        input.geometry.altitudeMslFt,
        input.severity,
        input.confidence,
        input.freshnessSeconds,
        JSON.stringify(input.metadata),
      ],
    );

    return toExternalOverlay(result.rows[0]);
  }

  async insertCrewedTrafficOverlay(
    tx: PoolClient,
    missionId: string,
    input: CreateCrewedTrafficExternalOverlayInput,
  ): Promise<ExternalOverlay> {
    const result = await tx.query<ExternalOverlayRow>(
      `
      insert into mission_external_overlays (
        id,
        mission_id,
        overlay_kind,
        source_provider,
        source_type,
        source_record_id,
        observed_at,
        valid_from,
        valid_to,
        geometry_type,
        latitude,
        longitude,
        altitude_msl_ft,
        heading_degrees,
        speed_knots,
        severity,
        confidence,
        freshness_seconds,
        metadata
      )
      values (
        $1, $2, 'crewed_traffic', $3, $4, $5, $6, $7, $8, 'point', $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb
      )
      returning *
      `,
      [
        randomUUID(),
        missionId,
        input.source.provider,
        input.source.sourceType,
        input.source.sourceRecordId,
        input.observedAt,
        input.validFrom,
        input.validTo,
        input.geometry.lat,
        input.geometry.lng,
        input.geometry.altitudeMslFt,
        input.headingDegrees,
        input.speedKnots,
        input.severity,
        input.confidence,
        input.freshnessSeconds,
        JSON.stringify(input.metadata),
      ],
    );

    return toExternalOverlay(result.rows[0]);
  }

  async insertDroneTrafficOverlay(
    tx: PoolClient,
    missionId: string,
    input: CreateDroneTrafficExternalOverlayInput,
  ): Promise<ExternalOverlay> {
    const result = await tx.query<ExternalOverlayRow>(
      `
      insert into mission_external_overlays (
        id,
        mission_id,
        overlay_kind,
        source_provider,
        source_type,
        source_record_id,
        observed_at,
        valid_from,
        valid_to,
        geometry_type,
        latitude,
        longitude,
        altitude_msl_ft,
        heading_degrees,
        speed_knots,
        severity,
        confidence,
        freshness_seconds,
        metadata
      )
      values (
        $1, $2, 'drone_traffic', $3, $4, $5, $6, $7, $8, 'point', $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb
      )
      returning *
      `,
      [
        randomUUID(),
        missionId,
        input.source.provider,
        input.source.sourceType,
        input.source.sourceRecordId,
        input.observedAt,
        input.validFrom,
        input.validTo,
        input.geometry.lat,
        input.geometry.lng,
        input.geometry.altitudeMslFt,
        input.headingDegrees,
        input.speedKnots,
        input.severity,
        input.confidence,
        input.freshnessSeconds,
        JSON.stringify(input.metadata),
      ],
    );

    return toExternalOverlay(result.rows[0]);
  }

  async insertAreaConflictOverlay(
    tx: PoolClient,
    missionId: string,
    input: CreateAreaConflictExternalOverlayInput,
  ): Promise<ExternalOverlay> {
    return this.upsertAreaConflictOverlay(tx, null, missionId, input);
  }

  async updateAreaConflictOverlay(
    tx: PoolClient,
    overlayId: string,
    missionId: string,
    input: CreateAreaConflictExternalOverlayInput,
  ): Promise<ExternalOverlay> {
    return this.upsertAreaConflictOverlay(tx, overlayId, missionId, input);
  }

  async retireAreaConflictOverlay(
    tx: PoolClient,
    overlayId: string,
    missionId: string,
    metadata: Record<string, unknown>,
  ): Promise<ExternalOverlay> {
    const result = await tx.query<ExternalOverlayRow>(
      `
      update mission_external_overlays
      set metadata = $3::jsonb,
          updated_at = now()
      where id = $1
        and mission_id = $2
        and overlay_kind = 'area_conflict'
      returning *
      `,
      [overlayId, missionId, JSON.stringify(metadata)],
    );

    return toExternalOverlay(result.rows[0]);
  }

  private async upsertAreaConflictOverlay(
    tx: PoolClient,
    overlayId: string | null,
    missionId: string,
    input: CreateAreaConflictExternalOverlayInput,
  ): Promise<ExternalOverlay> {
    const geometryType = input.geometry.type;
    const center =
      geometryType === "circle"
        ? { lat: input.geometry.centerLat, lng: input.geometry.centerLng }
        : polygonCentroid(input.geometry.points);
    const geometryMetadata =
      geometryType === "circle"
        ? {
            radiusMeters: input.geometry.radiusMeters,
            altitudeFloorFt: input.geometry.altitudeFloorFt ?? null,
            altitudeCeilingFt: input.geometry.altitudeCeilingFt ?? null,
          }
        : {
            points: input.geometry.points,
            altitudeFloorFt: input.geometry.altitudeFloorFt ?? null,
            altitudeCeilingFt: input.geometry.altitudeCeilingFt ?? null,
          };

    const parameters = [
      overlayId ?? randomUUID(),
      missionId,
      input.source.provider,
      input.source.sourceType,
      input.source.sourceRecordId,
      input.observedAt,
      input.validFrom,
      input.validTo,
      geometryType,
      center.lat,
      center.lng,
      input.severity,
      input.confidence,
      input.freshnessSeconds,
      JSON.stringify({
        ...input.metadata,
        ...geometryMetadata,
      }),
    ];

    const result = await tx.query<ExternalOverlayRow>(
      overlayId
        ? `
          update mission_external_overlays
          set source_provider = $3,
              source_type = $4,
              source_record_id = $5,
              observed_at = $6,
              valid_from = $7,
              valid_to = $8,
              geometry_type = $9,
              latitude = $10,
              longitude = $11,
              altitude_msl_ft = null,
              heading_degrees = null,
              speed_knots = null,
              severity = $12,
              confidence = $13,
              freshness_seconds = $14,
              metadata = $15::jsonb,
              updated_at = now()
          where id = $1
            and mission_id = $2
          returning *
        `
        : `
          insert into mission_external_overlays (
            id,
            mission_id,
            overlay_kind,
            source_provider,
            source_type,
            source_record_id,
            observed_at,
            valid_from,
            valid_to,
            geometry_type,
            latitude,
            longitude,
            altitude_msl_ft,
            heading_degrees,
            speed_knots,
            severity,
            confidence,
            freshness_seconds,
            metadata
          )
          values (
            $1, $2, 'area_conflict', $3, $4, $5, $6, $7, $8, $9, $10, $11, null, null, null, $12, $13, $14, $15::jsonb
          )
          returning *
        `,
      parameters,
    );

    return toExternalOverlay(result.rows[0]);
  }

  async listForMission(
    tx: PoolClient,
    missionId: string,
    filters: ListExternalOverlaysFilters = {},
  ): Promise<ExternalOverlay[]> {
    const result = await tx.query<ExternalOverlayRow>(
      `
      select *
      from mission_external_overlays
      where mission_id = $1
        and ($2::text is null or overlay_kind = $2)
        and (
          $3::boolean = true
          or overlay_kind <> 'area_conflict'
          or coalesce(metadata->'retirement'->>'retired', 'false') <> 'true'
        )
      order by observed_at desc, id desc
      `,
      [missionId, filters.kind ?? null, filters.includeRetired ?? false],
    );

    return result.rows.map(toExternalOverlay);
  }
}
