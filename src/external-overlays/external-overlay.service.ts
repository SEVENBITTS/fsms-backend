import type { Pool } from "pg";
import { ExternalOverlayRepository } from "./external-overlay.repository";
import { MissionExternalOverlayMissionNotFoundError } from "./external-overlay.errors";
import type {
  AreaConflictOverlayMetadata,
  CreateAreaConflictExternalOverlayInput,
  CreateCrewedTrafficExternalOverlayInput,
  CreateDroneTrafficExternalOverlayInput,
  CreateWeatherExternalOverlayInput,
  ExternalOverlay,
  ExternalOverlayKind,
  NormalizeAreaOverlaySourcesInput,
} from "./external-overlay.types";
import {
  validateCreateAreaConflictExternalOverlayInput,
  validateCreateCrewedTrafficExternalOverlayInput,
  validateCreateDroneTrafficExternalOverlayInput,
  validateNormalizeAreaOverlaySourcesInput,
  validateCreateWeatherExternalOverlayInput,
} from "./external-overlay.validators";

const AREA_SOURCE_PRIORITY: Record<string, number> = {
  danger_area: 1,
  temporary_danger_area: 2,
  notam_restriction: 3,
};

const severityRank: Record<string, number> = {
  info: 1,
  caution: 2,
  critical: 3,
};

const roundCoordinate = (value: number): number => Math.round(value * 100000) / 100000;

const dedupeGeometryKey = (
  geometry: NormalizeAreaOverlaySourcesInput["records"][number]["geometry"],
): string => {
  if (geometry.type === "circle") {
    return [
      "circle",
      roundCoordinate(geometry.centerLat),
      roundCoordinate(geometry.centerLng),
      Math.round(geometry.radiusMeters),
      geometry.altitudeFloorFt ?? "surface",
      geometry.altitudeCeilingFt ?? "open",
    ].join("|");
  }

  return [
    "polygon",
    ...geometry.points.flatMap((point) => [
      roundCoordinate(point.lat),
      roundCoordinate(point.lng),
    ]),
    geometry.altitudeFloorFt ?? "surface",
    geometry.altitudeCeilingFt ?? "open",
  ].join("|");
};

const dedupeWindowKey = (
  validFrom: string | null | undefined,
  validTo: string | null | undefined,
): string => `${validFrom ?? "open"}|${validTo ?? "open"}`;

const buildAreaDedupeKey = (
  record: NormalizeAreaOverlaySourcesInput["records"][number],
): string =>
  [
    dedupeGeometryKey(record.geometry),
    dedupeWindowKey(record.validFrom, record.validTo),
  ].join("|");

const areaSourcePriority = (sourceType: string): number =>
  AREA_SOURCE_PRIORITY[sourceType] ?? 0;

const normalizedAreaMetadata = (
  record: NormalizeAreaOverlaySourcesInput["records"][number],
  extras: Partial<AreaConflictOverlayMetadata> = {},
): AreaConflictOverlayMetadata => ({
  areaId: record.area.areaId,
  label: record.area.label,
  areaType: record.area.areaType,
  description: record.area.description ?? null,
  authorityName: record.area.authorityName ?? null,
  notamNumber: record.area.notamNumber ?? null,
  sourceReference: record.area.sourceReference ?? null,
  normalizedSourcePriority: areaSourcePriority(record.source.sourceType),
  dedupeKey: buildAreaDedupeKey(record),
  sourceTrace: [
    {
      provider: record.source.provider,
      sourceType: record.source.sourceType,
      sourceRecordId: record.source.sourceRecordId ?? null,
      authorityName: record.area.authorityName ?? null,
      notamNumber: record.area.notamNumber ?? null,
      sourceReference: record.area.sourceReference ?? null,
      areaId: record.area.areaId,
      label: record.area.label,
    },
  ],
  ...extras,
});

const compareAreaNormalizationPriority = (
  left: NormalizeAreaOverlaySourcesInput["records"][number],
  right: NormalizeAreaOverlaySourcesInput["records"][number],
): number => {
  const priorityDiff =
    areaSourcePriority(left.source.sourceType) - areaSourcePriority(right.source.sourceType);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const leftSeverity = severityRank[left.severity ?? "info"] ?? 0;
  const rightSeverity = severityRank[right.severity ?? "info"] ?? 0;
  if (leftSeverity !== rightSeverity) {
    return leftSeverity - rightSeverity;
  }

  const leftObserved = Date.parse(left.observedAt);
  const rightObserved = Date.parse(right.observedAt);
  return leftObserved - rightObserved;
};

export class ExternalOverlayService {
  constructor(
    private readonly pool: Pool,
    private readonly externalOverlayRepository: ExternalOverlayRepository,
  ) {}

  async createWeatherOverlay(
    missionId: string,
    input: unknown,
  ): Promise<ExternalOverlay> {
    const validated = validateCreateWeatherExternalOverlayInput(input);
    const client = await this.pool.connect();

    try {
      const exists = await this.externalOverlayRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new MissionExternalOverlayMissionNotFoundError(missionId);
      }

      return await this.externalOverlayRepository.insertWeatherOverlay(
        client,
        missionId,
        validated,
      );
    } finally {
      client.release();
    }
  }

  async createCrewedTrafficOverlay(
    missionId: string,
    input: unknown,
  ): Promise<ExternalOverlay> {
    const validated = validateCreateCrewedTrafficExternalOverlayInput(input);
    const client = await this.pool.connect();

    try {
      const exists = await this.externalOverlayRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new MissionExternalOverlayMissionNotFoundError(missionId);
      }

      return await this.externalOverlayRepository.insertCrewedTrafficOverlay(
        client,
        missionId,
        validated,
      );
    } finally {
      client.release();
    }
  }

  async createDroneTrafficOverlay(
    missionId: string,
    input: unknown,
  ): Promise<ExternalOverlay> {
    const validated = validateCreateDroneTrafficExternalOverlayInput(input);
    const client = await this.pool.connect();

    try {
      const exists = await this.externalOverlayRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new MissionExternalOverlayMissionNotFoundError(missionId);
      }

      return await this.externalOverlayRepository.insertDroneTrafficOverlay(
        client,
        missionId,
        validated,
      );
    } finally {
      client.release();
    }
  }

  async createAreaConflictOverlay(
    missionId: string,
    input: unknown,
  ): Promise<ExternalOverlay> {
    const validated = validateCreateAreaConflictExternalOverlayInput(input);
    const client = await this.pool.connect();

    try {
      const exists = await this.externalOverlayRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new MissionExternalOverlayMissionNotFoundError(missionId);
      }

      return await this.externalOverlayRepository.insertAreaConflictOverlay(
        client,
        missionId,
        validated,
      );
    } finally {
      client.release();
    }
  }

  async normalizeAreaOverlaySources(
    missionId: string,
    input: unknown,
  ): Promise<{ missionId: string; overlays: ExternalOverlay[] }> {
    const validated = validateNormalizeAreaOverlaySourcesInput(input);
    const client = await this.pool.connect();

    try {
      const exists = await this.externalOverlayRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new MissionExternalOverlayMissionNotFoundError(missionId);
      }

      const dedupedRecords = new Map<
        string,
        {
          winner: NormalizeAreaOverlaySourcesInput["records"][number];
          sourceTrace: NonNullable<AreaConflictOverlayMetadata["sourceTrace"]>;
        }
      >();

      for (const record of validated.records) {
        const dedupeKey = buildAreaDedupeKey(record);
        const traceEntry = normalizedAreaMetadata(record).sourceTrace ?? [];
        const existing = dedupedRecords.get(dedupeKey);

        if (!existing) {
          dedupedRecords.set(dedupeKey, {
            winner: record,
            sourceTrace: traceEntry,
          });
          continue;
        }

        const nextTrace = [...existing.sourceTrace, ...traceEntry];
        if (compareAreaNormalizationPriority(record, existing.winner) > 0) {
          dedupedRecords.set(dedupeKey, {
            winner: record,
            sourceTrace: nextTrace,
          });
          continue;
        }

        dedupedRecords.set(dedupeKey, {
          winner: existing.winner,
          sourceTrace: nextTrace,
        });
      }

      const overlays: ExternalOverlay[] = [];
      for (const { winner, sourceTrace } of dedupedRecords.values()) {
        overlays.push(
          await this.externalOverlayRepository.insertAreaConflictOverlay(
            client,
            missionId,
            {
              kind: "area_conflict",
              source: winner.source,
              observedAt: winner.observedAt,
              validFrom: winner.validFrom,
              validTo: winner.validTo,
              geometry: winner.geometry,
              severity: winner.severity,
              confidence: winner.confidence,
              freshnessSeconds: winner.freshnessSeconds,
              metadata: normalizedAreaMetadata(winner, {
                sourceTrace,
              }),
            },
          ),
        );
      }

      return {
        missionId,
        overlays,
      };
    } finally {
      client.release();
    }
  }

  async listExternalOverlays(
    missionId: string,
    filters: { kind?: ExternalOverlayKind } = {},
  ): Promise<{ missionId: string; overlays: ExternalOverlay[] }> {
    const client = await this.pool.connect();

    try {
      const exists = await this.externalOverlayRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new MissionExternalOverlayMissionNotFoundError(missionId);
      }

      const overlays = await this.externalOverlayRepository.listForMission(
        client,
        missionId,
        filters,
      );

      return {
        missionId,
        overlays,
      };
    } finally {
      client.release();
    }
  }
}
