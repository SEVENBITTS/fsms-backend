import { randomUUID } from "crypto";
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
  ExternalOverlayCircleGeometry,
  ExternalOverlayKind,
  ExternalOverlayPolygonGeometry,
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
  refreshRunId: string,
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
  retirement: {
    retired: false,
    retiredAt: null,
    reason: null,
  },
  refreshProvenance: {
    createdByRunId: refreshRunId,
    lastUpdatedByRunId: refreshRunId,
    supersededByRunId: null,
    retiredByRunId: null,
  },
  ...extras,
});

const sourceTraceEntryKey = (
  entry: NonNullable<AreaConflictOverlayMetadata["sourceTrace"]>[number],
): string =>
  [
    entry.provider,
    entry.sourceType,
    entry.sourceRecordId ?? "",
    entry.areaId,
  ].join("|");

const mergeSourceTrace = (
  ...traces: Array<NonNullable<AreaConflictOverlayMetadata["sourceTrace"]> | undefined>
): NonNullable<AreaConflictOverlayMetadata["sourceTrace"]> => {
  const merged = new Map<
    string,
    NonNullable<AreaConflictOverlayMetadata["sourceTrace"]>[number]
  >();

  for (const trace of traces) {
    for (const entry of trace ?? []) {
      merged.set(sourceTraceEntryKey(entry), entry);
    }
  }

  return [...merged.values()];
};

const areaMetadataFromOverlay = (
  overlay: ExternalOverlay,
): AreaConflictOverlayMetadata => overlay.metadata as unknown as AreaConflictOverlayMetadata;

const isAreaConflictGeometry = (
  geometry: ExternalOverlay["geometry"],
): geometry is ExternalOverlayCircleGeometry | ExternalOverlayPolygonGeometry =>
  geometry.type === "circle" || geometry.type === "polygon";

const sourceTraceFromOverlay = (
  overlay: ExternalOverlay,
): NonNullable<AreaConflictOverlayMetadata["sourceTrace"]> => {
  const metadata = areaMetadataFromOverlay(overlay);
  if (Array.isArray(metadata.sourceTrace) && metadata.sourceTrace.length > 0) {
    return metadata.sourceTrace;
  }

  return [
    {
      provider: overlay.source.provider,
      sourceType: overlay.source.sourceType,
      sourceRecordId: overlay.source.sourceRecordId ?? null,
      authorityName: metadata.authorityName ?? null,
      notamNumber: metadata.notamNumber ?? null,
      sourceReference: metadata.sourceReference ?? null,
      areaId: metadata.areaId,
      label: metadata.label,
    },
  ];
};

const dedupeKeyFromOverlay = (overlay: ExternalOverlay): string | null => {
  const metadata = areaMetadataFromOverlay(overlay);
  if (typeof metadata.dedupeKey === "string" && metadata.dedupeKey.length > 0) {
    return metadata.dedupeKey;
  }

  if (overlay.kind !== "area_conflict" || !isAreaConflictGeometry(overlay.geometry)) {
    return null;
  }

  return [
    dedupeGeometryKey(overlay.geometry),
    dedupeWindowKey(overlay.validFrom, overlay.validTo),
  ].join("|");
};

const isRetiredAreaOverlay = (overlay: ExternalOverlay): boolean => {
  const metadata = areaMetadataFromOverlay(overlay);
  return metadata.retirement?.retired === true;
};

const isNormalizedAreaOverlay = (overlay: ExternalOverlay): boolean => {
  const metadata = areaMetadataFromOverlay(overlay);
  return typeof metadata.dedupeKey === "string" && metadata.dedupeKey.length > 0;
};

type AreaRefreshRunOverlaySummary = {
  overlayId: string;
  areaId: string;
  label: string;
  sourceType: string;
  sourceRecordId: string | null;
  retired: boolean;
};

type AreaRefreshRunSummary = {
  refreshRunId: string;
  created: AreaRefreshRunOverlaySummary[];
  updated: AreaRefreshRunOverlaySummary[];
  superseded: AreaRefreshRunOverlaySummary[];
  retired: AreaRefreshRunOverlaySummary[];
  active: AreaRefreshRunOverlaySummary[];
};

const toRefreshRunOverlaySummary = (
  overlay: ExternalOverlay,
): AreaRefreshRunOverlaySummary => {
  const metadata = areaMetadataFromOverlay(overlay);
  return {
    overlayId: overlay.id,
    areaId: metadata.areaId,
    label: metadata.label,
    sourceType: overlay.source.sourceType,
    sourceRecordId: overlay.source.sourceRecordId,
    retired: metadata.retirement?.retired === true,
  };
};

const compareIncomingToExistingAreaPriority = (
  incoming: NormalizeAreaOverlaySourcesInput["records"][number],
  existing: ExternalOverlay,
): number => {
  const priorityDiff =
    areaSourcePriority(incoming.source.sourceType) -
    areaSourcePriority(existing.source.sourceType);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const incomingSeverity = severityRank[incoming.severity ?? "info"] ?? 0;
  const existingSeverity = severityRank[existing.severity ?? "info"] ?? 0;
  if (incomingSeverity !== existingSeverity) {
    return incomingSeverity - existingSeverity;
  }

  const incomingObserved = Date.parse(incoming.observedAt);
  const existingObserved = Date.parse(existing.observedAt);
  return incomingObserved - existingObserved;
};

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
  ): Promise<{ missionId: string; refreshRunId: string; overlays: ExternalOverlay[] }> {
    const validated = validateNormalizeAreaOverlaySourcesInput(input);
    const refreshRunId = randomUUID();
    const client = await this.pool.connect();

    try {
      const exists = await this.externalOverlayRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new MissionExternalOverlayMissionNotFoundError(missionId);
      }

      const existingAreaOverlays = await this.externalOverlayRepository.listForMission(
        client,
        missionId,
        { kind: "area_conflict", includeRetired: true },
      );
      const existingByDedupeKey = new Map<string, ExternalOverlay>();
      for (const overlay of existingAreaOverlays) {
        if (isRetiredAreaOverlay(overlay)) {
          continue;
        }
        const dedupeKey = dedupeKeyFromOverlay(overlay);
        if (dedupeKey) {
          existingByDedupeKey.set(dedupeKey, overlay);
        }
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
        const traceEntry = normalizedAreaMetadata(record, refreshRunId).sourceTrace ?? [];
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
      const processedDedupeKeys = new Set<string>();
      for (const [dedupeKey, { winner, sourceTrace }] of dedupedRecords.entries()) {
        processedDedupeKeys.add(dedupeKey);
        const existing = existingByDedupeKey.get(dedupeKey);

        if (!existing) {
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
                metadata: normalizedAreaMetadata(winner, refreshRunId, {
                  dedupeKey,
                  sourceTrace,
                  supersession: {
                    supersededExisting: false,
                    replacedSourceType: null,
                    replacedSourceRecordId: null,
                  },
                }),
              },
            ),
          );
          continue;
        }

        const existingMetadata = areaMetadataFromOverlay(existing);
        const mergedTrace = mergeSourceTrace(
          sourceTraceFromOverlay(existing),
          sourceTrace,
        );
        const incomingWins =
          compareIncomingToExistingAreaPriority(winner, existing) > 0;

        if (incomingWins) {
          overlays.push(
            await this.externalOverlayRepository.updateAreaConflictOverlay(
              client,
              existing.id,
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
                metadata: normalizedAreaMetadata(winner, refreshRunId, {
                  dedupeKey,
                  sourceTrace: mergedTrace,
                  supersession: {
                    supersededExisting: true,
                    replacedSourceType: existing.source.sourceType,
                    replacedSourceRecordId: existing.source.sourceRecordId,
                  },
                  refreshProvenance: {
                    createdByRunId:
                      existingMetadata.refreshProvenance?.createdByRunId ?? refreshRunId,
                    lastUpdatedByRunId: refreshRunId,
                    supersededByRunId: refreshRunId,
                    retiredByRunId: null,
                  },
                }),
              },
            ),
          );
          continue;
        }

        overlays.push(
          await this.externalOverlayRepository.updateAreaConflictOverlay(
            client,
            existing.id,
            missionId,
            {
              kind: "area_conflict",
              source: {
                provider: existing.source.provider,
                sourceType: existing.source.sourceType,
                sourceRecordId: existing.source.sourceRecordId,
              },
              observedAt: existing.observedAt,
              validFrom: existing.validFrom,
              validTo: existing.validTo,
              geometry: isAreaConflictGeometry(existing.geometry)
                ? existing.geometry
                : winner.geometry,
              severity: existing.severity,
              confidence: existing.confidence,
              freshnessSeconds: existing.freshnessSeconds,
              metadata: {
                areaId: existingMetadata.areaId,
                label: existingMetadata.label,
                areaType: existingMetadata.areaType,
                description: existingMetadata.description ?? null,
                authorityName: existingMetadata.authorityName ?? null,
                notamNumber: existingMetadata.notamNumber ?? null,
                sourceReference: existingMetadata.sourceReference ?? null,
                normalizedSourcePriority:
                  existingMetadata.normalizedSourcePriority ??
                  areaSourcePriority(existing.source.sourceType),
                dedupeKey,
                sourceTrace: mergedTrace,
                supersession: {
                  supersededExisting: false,
                  replacedSourceType: null,
                  replacedSourceRecordId: null,
                },
                retirement: {
                  retired: false,
                  retiredAt: null,
                  reason: null,
                },
                refreshProvenance: {
                  createdByRunId:
                    existingMetadata.refreshProvenance?.createdByRunId ?? refreshRunId,
                  lastUpdatedByRunId: refreshRunId,
                  supersededByRunId:
                    existingMetadata.refreshProvenance?.supersededByRunId ?? null,
                  retiredByRunId: null,
                },
              },
            },
          ),
        );
      }

      const retirementTimestamp = new Date().toISOString();
      for (const overlay of existingAreaOverlays) {
        if (isRetiredAreaOverlay(overlay)) {
          continue;
        }

        const dedupeKey = dedupeKeyFromOverlay(overlay);
        if (
          !dedupeKey ||
          processedDedupeKeys.has(dedupeKey) ||
          !isNormalizedAreaOverlay(overlay)
        ) {
          continue;
        }

        const metadata = areaMetadataFromOverlay(overlay);
        await this.externalOverlayRepository.retireAreaConflictOverlay(
          client,
          overlay.id,
          missionId,
          {
            ...metadata,
            retirement: {
              retired: true,
              retiredAt: retirementTimestamp,
              reason: "missing_from_refresh",
            },
            refreshProvenance: {
              createdByRunId:
                metadata.refreshProvenance?.createdByRunId ?? refreshRunId,
              lastUpdatedByRunId: refreshRunId,
              supersededByRunId:
                metadata.refreshProvenance?.supersededByRunId ?? null,
              retiredByRunId: refreshRunId,
            },
          },
        );
      }

      return {
        missionId,
        refreshRunId,
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

  async listAreaOverlayRefreshRuns(
    missionId: string,
  ): Promise<{ missionId: string; refreshRuns: AreaRefreshRunSummary[] }> {
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
        { kind: "area_conflict", includeRetired: true },
      );

      const runs = new Map<string, AreaRefreshRunSummary>();
      const ensureRun = (refreshRunId: string): AreaRefreshRunSummary => {
        const existingRun = runs.get(refreshRunId);
        if (existingRun) {
          return existingRun;
        }

        const createdRun: AreaRefreshRunSummary = {
          refreshRunId,
          created: [],
          updated: [],
          superseded: [],
          retired: [],
          active: [],
        };
        runs.set(refreshRunId, createdRun);
        return createdRun;
      };

      for (const overlay of overlays) {
        if (!isNormalizedAreaOverlay(overlay)) {
          continue;
        }

        const metadata = areaMetadataFromOverlay(overlay);
        const provenance = metadata.refreshProvenance;
        if (!provenance?.createdByRunId || !provenance.lastUpdatedByRunId) {
          continue;
        }

        const summary = toRefreshRunOverlaySummary(overlay);

        ensureRun(provenance.createdByRunId).created.push(summary);

        if (provenance.lastUpdatedByRunId !== provenance.createdByRunId) {
          ensureRun(provenance.lastUpdatedByRunId).updated.push(summary);
        }

        if (provenance.supersededByRunId) {
          ensureRun(provenance.supersededByRunId).superseded.push(summary);
        }

        if (provenance.retiredByRunId) {
          ensureRun(provenance.retiredByRunId).retired.push(summary);
        }

        if (!summary.retired) {
          ensureRun(provenance.lastUpdatedByRunId).active.push(summary);
        }
      }

      const refreshRuns = [...runs.values()].sort((left, right) =>
        right.refreshRunId.localeCompare(left.refreshRunId),
      );

      return {
        missionId,
        refreshRuns,
      };
    } finally {
      client.release();
    }
  }
}
