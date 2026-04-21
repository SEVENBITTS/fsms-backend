import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type {
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
  geometry_type: "point";
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
  geometry: {
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
      order by observed_at desc, id desc
      `,
      [missionId, filters.kind ?? null],
    );

    return result.rows.map(toExternalOverlay);
  }
}
