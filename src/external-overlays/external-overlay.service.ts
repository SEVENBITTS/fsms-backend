import { randomUUID } from "crypto";
import type { Pool } from "pg";
import { ExternalOverlayRepository } from "./external-overlay.repository";
import {
  MissionExternalOverlayRefreshRunChronologyQueryInvalidError,
  MissionExternalOverlayMissionNotFoundError,
  MissionExternalOverlayRefreshRunDiffQueryInvalidError,
  MissionExternalOverlayRefreshRunNotFoundError,
  MissionExternalOverlayRefreshRunTransitionArtifactChronologyQueryInvalidError,
  MissionExternalOverlayRefreshRunTransitionArtifactQueryInvalidError,
  MissionExternalOverlayRefreshRunTransitionDrilldownQueryInvalidError,
} from "./external-overlay.errors";
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

type AreaOverlayRefreshRunSummaryItem = {
  overlayId: string;
  areaId: string;
  label: string;
  sourceType: string;
  sourceRecordId: string | null;
  retired: boolean;
};

type AreaOverlayRefreshRunSummary = {
  refreshRunId: string;
  missionId: string;
  created: AreaOverlayRefreshRunSummaryItem[];
  updated: AreaOverlayRefreshRunSummaryItem[];
  superseded: AreaOverlayRefreshRunSummaryItem[];
  retired: AreaOverlayRefreshRunSummaryItem[];
  active: AreaOverlayRefreshRunSummaryItem[];
};

type AreaOverlayRefreshRunDiff = {
  missionId: string;
  fromRefreshRunId: string;
  toRefreshRunId: string;
  added: AreaOverlayRefreshRunSummaryItem[];
  removed: AreaOverlayRefreshRunSummaryItem[];
  persisted: AreaOverlayRefreshRunSummaryItem[];
  changed: {
    updated: AreaOverlayRefreshRunSummaryItem[];
    superseded: AreaOverlayRefreshRunSummaryItem[];
    retired: AreaOverlayRefreshRunSummaryItem[];
  };
};

type AreaOverlayRefreshRunChronology = {
  missionId: string;
  refreshRuns: AreaOverlayRefreshRunSummary[];
  transitions: AreaOverlayRefreshRunDiff[];
};

type AreaOverlayRefreshRunTransitionDrilldown = {
  missionId: string;
  transition: AreaOverlayRefreshRunDiff;
};

type AreaOverlayRefreshRunTransitionArtifact = {
  artifactId: string;
  missionId: string;
  artifactType: "refresh_run_transition";
  fromRefreshRunId: string;
  toRefreshRunId: string;
  transition: AreaOverlayRefreshRunDiff;
};

type AreaOverlayRefreshRunTransitionArtifactChronology = {
  missionId: string;
  artifacts: AreaOverlayRefreshRunTransitionArtifact[];
};

const buildAreaOverlayRefreshRunTransitionArtifactId = (
  missionId: string,
  fromRefreshRunId: string,
  toRefreshRunId: string,
): string =>
  [
    "refresh_run_transition",
    missionId,
    fromRefreshRunId,
    toRefreshRunId,
  ].join(":");

const parseAreaOverlayRefreshRunTransitionArtifactId = (
  artifactId: string,
): {
  missionId: string;
  fromRefreshRunId: string;
  toRefreshRunId: string;
} | null => {
  const parts = artifactId.split(":");
  if (parts.length !== 4 || parts[0] !== "refresh_run_transition") {
    return null;
  }

  const [, missionId, fromRefreshRunId, toRefreshRunId] = parts;
  if (!missionId || !fromRefreshRunId || !toRefreshRunId) {
    return null;
  }

  return {
    missionId,
    fromRefreshRunId,
    toRefreshRunId,
  };
};

const buildAreaOverlayRefreshRunTransitionArtifact = (
  missionId: string,
  transition: AreaOverlayRefreshRunDiff,
): AreaOverlayRefreshRunTransitionArtifact => ({
  artifactId: buildAreaOverlayRefreshRunTransitionArtifactId(
    missionId,
    transition.fromRefreshRunId,
    transition.toRefreshRunId,
  ),
  missionId,
  artifactType: "refresh_run_transition",
  fromRefreshRunId: transition.fromRefreshRunId,
  toRefreshRunId: transition.toRefreshRunId,
  transition,
});

const areaOverlayRefreshSummaryItemFromOverlay = (
  overlay: ExternalOverlay,
): AreaOverlayRefreshRunSummaryItem => {
  const metadata = areaMetadataFromOverlay(overlay);

  return {
    overlayId: overlay.id,
    areaId: metadata.areaId,
    label: metadata.label,
    sourceType: overlay.source.sourceType,
    sourceRecordId: overlay.source.sourceRecordId ?? null,
    retired: isRetiredAreaOverlay(overlay),
  };
};

const buildAreaOverlayRefreshRunSummaries = (
  missionId: string,
  overlays: ExternalOverlay[],
): AreaOverlayRefreshRunSummary[] => {
  const refreshRunMap = new Map<string, AreaOverlayRefreshRunSummary>();

  const ensureSummary = (refreshRunId: string): AreaOverlayRefreshRunSummary => {
    const existingSummary = refreshRunMap.get(refreshRunId);
    if (existingSummary) {
      return existingSummary;
    }

    const createdSummary: AreaOverlayRefreshRunSummary = {
      refreshRunId,
      missionId,
      created: [],
      updated: [],
      superseded: [],
      retired: [],
      active: [],
    };
    refreshRunMap.set(refreshRunId, createdSummary);
    return createdSummary;
  };

  for (const overlay of overlays) {
    if (!isNormalizedAreaOverlay(overlay)) {
      continue;
    }

    const provenance = areaMetadataFromOverlay(overlay).refreshProvenance;
    if (!provenance) {
      continue;
    }

    const summaryItem = areaOverlayRefreshSummaryItemFromOverlay(overlay);
    ensureSummary(provenance.createdByRunId).created.push(summaryItem);
    ensureSummary(provenance.lastUpdatedByRunId).updated.push(summaryItem);

    if (provenance.supersededByRunId) {
      ensureSummary(provenance.supersededByRunId).superseded.push(summaryItem);
    }

    if (provenance.retiredByRunId) {
      ensureSummary(provenance.retiredByRunId).retired.push(summaryItem);
    }

    if (!summaryItem.retired) {
      ensureSummary(provenance.lastUpdatedByRunId).active.push(summaryItem);
    }
  }

  return [...refreshRunMap.values()].sort((left, right) =>
    right.refreshRunId.localeCompare(left.refreshRunId),
  );
};

const buildRefreshRunOrder = (overlays: ExternalOverlay[]): Map<string, number> => {
  const nodes = new Set<string>();
  const outgoing = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();

  const ensureNode = (runId: string): void => {
    nodes.add(runId);
    if (!outgoing.has(runId)) {
      outgoing.set(runId, new Set());
    }
    if (!indegree.has(runId)) {
      indegree.set(runId, 0);
    }
  };

  const addEdge = (fromRunId: string, toRunId: string): void => {
    if (fromRunId === toRunId) {
      ensureNode(fromRunId);
      return;
    }

    ensureNode(fromRunId);
    ensureNode(toRunId);

    const edges = outgoing.get(fromRunId);
    if (!edges || edges.has(toRunId)) {
      return;
    }

    edges.add(toRunId);
    indegree.set(toRunId, (indegree.get(toRunId) ?? 0) + 1);
  };

  for (const overlay of overlays) {
    if (!isNormalizedAreaOverlay(overlay)) {
      continue;
    }

    const provenance = areaMetadataFromOverlay(overlay).refreshProvenance;
    if (!provenance) {
      continue;
    }

    ensureNode(provenance.createdByRunId);
    ensureNode(provenance.lastUpdatedByRunId);

    addEdge(provenance.createdByRunId, provenance.lastUpdatedByRunId);

    if (provenance.supersededByRunId) {
      ensureNode(provenance.supersededByRunId);
      addEdge(provenance.createdByRunId, provenance.supersededByRunId);
      addEdge(provenance.supersededByRunId, provenance.lastUpdatedByRunId);
    }

    if (provenance.retiredByRunId) {
      ensureNode(provenance.retiredByRunId);
      addEdge(provenance.createdByRunId, provenance.retiredByRunId);
      addEdge(provenance.lastUpdatedByRunId, provenance.retiredByRunId);
      if (provenance.supersededByRunId) {
        addEdge(provenance.supersededByRunId, provenance.retiredByRunId);
      }
    }
  }

  const queue = [...nodes]
    .filter((runId) => (indegree.get(runId) ?? 0) === 0)
    .sort((left, right) => left.localeCompare(right));
  const orderedRunIds: string[] = [];

  while (queue.length > 0) {
    const nextRunId = queue.shift();
    if (!nextRunId) {
      break;
    }

    orderedRunIds.push(nextRunId);

    for (const adjacentRunId of outgoing.get(nextRunId) ?? []) {
      const nextIndegree = (indegree.get(adjacentRunId) ?? 0) - 1;
      indegree.set(adjacentRunId, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(adjacentRunId);
        queue.sort((left, right) => left.localeCompare(right));
      }
    }
  }

  const unresolvedRunIds = [...nodes]
    .filter((runId) => !orderedRunIds.includes(runId))
    .sort((left, right) => left.localeCompare(right));
  orderedRunIds.push(...unresolvedRunIds);

  return new Map(orderedRunIds.map((runId, index) => [runId, index] as const));
};

const buildAreaOverlaySnapshotForRun = (
  overlays: ExternalOverlay[],
  refreshRunOrder: Map<string, number>,
  refreshRunId: string,
): AreaOverlayRefreshRunSummaryItem[] => {
  const snapshotIndex = refreshRunOrder.get(refreshRunId);
  if (snapshotIndex === undefined) {
    return [];
  }

  return overlays
    .filter((overlay) => isNormalizedAreaOverlay(overlay))
    .map((overlay) => ({
      overlay,
      provenance: areaMetadataFromOverlay(overlay).refreshProvenance,
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        overlay: ExternalOverlay;
        provenance: NonNullable<AreaConflictOverlayMetadata["refreshProvenance"]>;
      } => candidate.provenance !== null,
    )
    .filter(({ provenance }) => {
      const createdIndex = refreshRunOrder.get(provenance.createdByRunId);
      if (createdIndex === undefined || createdIndex > snapshotIndex) {
        return false;
      }

      if (!provenance.retiredByRunId) {
        return true;
      }

      const retiredIndex = refreshRunOrder.get(provenance.retiredByRunId);
      return retiredIndex === undefined || retiredIndex > snapshotIndex;
    })
    .map(({ overlay }) => areaOverlayRefreshSummaryItemFromOverlay(overlay));
};

const buildAreaOverlayRefreshRunDiff = (
  missionId: string,
  overlays: ExternalOverlay[],
  refreshRuns: AreaOverlayRefreshRunSummary[],
  refreshRunOrder: Map<string, number>,
  fromRefreshRunId: string,
  toRefreshRunId: string,
): AreaOverlayRefreshRunDiff => {
  const fromRun = refreshRuns.find(
    (refreshRun) => refreshRun.refreshRunId === fromRefreshRunId,
  );
  if (!fromRun) {
    throw new MissionExternalOverlayRefreshRunNotFoundError(
      missionId,
      fromRefreshRunId,
    );
  }

  const toRun = refreshRuns.find(
    (refreshRun) => refreshRun.refreshRunId === toRefreshRunId,
  );
  if (!toRun) {
    throw new MissionExternalOverlayRefreshRunNotFoundError(
      missionId,
      toRefreshRunId,
    );
  }

  const fromSnapshot = buildAreaOverlaySnapshotForRun(
    overlays,
    refreshRunOrder,
    fromRefreshRunId,
  );
  const toSnapshot = buildAreaOverlaySnapshotForRun(
    overlays,
    refreshRunOrder,
    toRefreshRunId,
  );

  const fromActiveById = new Map(
    fromSnapshot.map((item) => [item.overlayId, item] as const),
  );
  const toActiveById = new Map(
    toSnapshot.map((item) => [item.overlayId, item] as const),
  );

  const added = toSnapshot.filter((item) => !fromActiveById.has(item.overlayId));
  const removed = fromSnapshot.filter((item) => !toActiveById.has(item.overlayId));
  const persisted = toSnapshot.filter((item) => fromActiveById.has(item.overlayId));
  const persistedIds = new Set(persisted.map((item) => item.overlayId));
  const removedIds = new Set(removed.map((item) => item.overlayId));

  return {
    missionId,
    fromRefreshRunId,
    toRefreshRunId,
    added,
    removed,
    persisted,
    changed: {
      updated: toRun.updated.filter((item) => persistedIds.has(item.overlayId)),
      superseded: toRun.superseded.filter((item) => persistedIds.has(item.overlayId)),
      retired: toRun.retired.filter((item) => removedIds.has(item.overlayId)),
    },
  };
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
    filters: { refreshRunId?: string } = {},
  ): Promise<{ missionId: string; refreshRuns: AreaOverlayRefreshRunSummary[] }> {
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
      const refreshRuns = buildAreaOverlayRefreshRunSummaries(missionId, overlays);

      if (filters.refreshRunId) {
        const matchingRun = refreshRuns.find(
          (refreshRun) => refreshRun.refreshRunId === filters.refreshRunId,
        );

        if (!matchingRun) {
          throw new MissionExternalOverlayRefreshRunNotFoundError(
            missionId,
            filters.refreshRunId,
          );
        }

        return {
          missionId,
          refreshRuns: [matchingRun],
        };
      }

      return {
        missionId,
        refreshRuns,
      };
    } finally {
      client.release();
    }
  }

  async diffAreaOverlayRefreshRuns(
    missionId: string,
    filters: {
      fromRefreshRunId?: string;
      toRefreshRunId?: string;
    },
  ): Promise<{ missionId: string; diff: AreaOverlayRefreshRunDiff }> {
    if (!filters.fromRefreshRunId || !filters.toRefreshRunId) {
      throw new MissionExternalOverlayRefreshRunDiffQueryInvalidError(
        "Both fromRefreshRunId and toRefreshRunId are required for refresh-run diff queries",
      );
    }

    if (filters.fromRefreshRunId === filters.toRefreshRunId) {
      throw new MissionExternalOverlayRefreshRunDiffQueryInvalidError(
        "fromRefreshRunId and toRefreshRunId must be different",
      );
    }

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
      const refreshRuns = buildAreaOverlayRefreshRunSummaries(missionId, overlays);
      const refreshRunOrder = buildRefreshRunOrder(overlays);

      return {
        missionId,
        diff: buildAreaOverlayRefreshRunDiff(
          missionId,
          overlays,
          refreshRuns,
          refreshRunOrder,
          filters.fromRefreshRunId,
          filters.toRefreshRunId,
        ),
      };
    } finally {
      client.release();
    }
  }

  async getAreaOverlayRefreshRunTransition(
    missionId: string,
    filters: {
      refreshRunId?: string;
      fromRefreshRunId?: string;
      toRefreshRunId?: string;
      chronology?: boolean;
      transitionFromRefreshRunId?: string;
      transitionToRefreshRunId?: string;
    },
  ): Promise<AreaOverlayRefreshRunTransitionDrilldown> {
    if (
      !filters.transitionFromRefreshRunId ||
      !filters.transitionToRefreshRunId
    ) {
      throw new MissionExternalOverlayRefreshRunTransitionDrilldownQueryInvalidError(
        "Both transitionFromRefreshRunId and transitionToRefreshRunId are required for refresh-run transition drilldown queries",
      );
    }

    if (
      filters.transitionFromRefreshRunId === filters.transitionToRefreshRunId
    ) {
      throw new MissionExternalOverlayRefreshRunTransitionDrilldownQueryInvalidError(
        "transitionFromRefreshRunId and transitionToRefreshRunId must be different",
      );
    }

    if (
      filters.refreshRunId ||
      filters.fromRefreshRunId ||
      filters.toRefreshRunId ||
      filters.chronology
    ) {
      throw new MissionExternalOverlayRefreshRunTransitionDrilldownQueryInvalidError(
        "transition drilldown queries cannot be combined with refreshRunId, fromRefreshRunId, toRefreshRunId, or chronology",
      );
    }

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
      const refreshRuns = buildAreaOverlayRefreshRunSummaries(missionId, overlays);
      const refreshRunOrder = buildRefreshRunOrder(overlays);

      return {
        missionId,
        transition: buildAreaOverlayRefreshRunDiff(
          missionId,
          overlays,
          refreshRuns,
          refreshRunOrder,
          filters.transitionFromRefreshRunId,
          filters.transitionToRefreshRunId,
        ),
      };
    } finally {
      client.release();
    }
  }

  async getAreaOverlayRefreshRunTransitionArtifact(
    missionId: string,
    filters: {
      refreshRunId?: string;
      fromRefreshRunId?: string;
      toRefreshRunId?: string;
      chronology?: boolean;
      transitionFromRefreshRunId?: string;
      transitionToRefreshRunId?: string;
      transitionArtifactId?: string;
    },
  ): Promise<{ missionId: string; artifact: AreaOverlayRefreshRunTransitionArtifact }> {
    if (
      filters.refreshRunId ||
      filters.fromRefreshRunId ||
      filters.toRefreshRunId ||
      filters.chronology
    ) {
      throw new MissionExternalOverlayRefreshRunTransitionArtifactQueryInvalidError(
        "transition artifact queries cannot be combined with refreshRunId, fromRefreshRunId, toRefreshRunId, or chronology",
      );
    }

    let transitionFromRefreshRunId = filters.transitionFromRefreshRunId;
    let transitionToRefreshRunId = filters.transitionToRefreshRunId;

    if (filters.transitionArtifactId) {
      if (transitionFromRefreshRunId || transitionToRefreshRunId) {
        throw new MissionExternalOverlayRefreshRunTransitionArtifactQueryInvalidError(
          "transitionArtifactId cannot be combined with transitionFromRefreshRunId or transitionToRefreshRunId",
        );
      }

      const parsedArtifactId = parseAreaOverlayRefreshRunTransitionArtifactId(
        filters.transitionArtifactId,
      );
      if (!parsedArtifactId) {
        throw new MissionExternalOverlayRefreshRunTransitionArtifactQueryInvalidError(
          "transitionArtifactId must use the refresh_run_transition:<missionId>:<fromRefreshRunId>:<toRefreshRunId> format",
        );
      }

      if (parsedArtifactId.missionId !== missionId) {
        throw new MissionExternalOverlayRefreshRunTransitionArtifactQueryInvalidError(
          "transitionArtifactId mission id does not match the requested mission",
        );
      }

      transitionFromRefreshRunId = parsedArtifactId.fromRefreshRunId;
      transitionToRefreshRunId = parsedArtifactId.toRefreshRunId;
    }

    if (!transitionFromRefreshRunId || !transitionToRefreshRunId) {
      throw new MissionExternalOverlayRefreshRunTransitionArtifactQueryInvalidError(
        "Either transitionArtifactId or both transitionFromRefreshRunId and transitionToRefreshRunId are required for refresh-run transition artifact queries",
      );
    }

    if (transitionFromRefreshRunId === transitionToRefreshRunId) {
      throw new MissionExternalOverlayRefreshRunTransitionArtifactQueryInvalidError(
        "transitionFromRefreshRunId and transitionToRefreshRunId must be different",
      );
    }

    const transitionResult = await this.getAreaOverlayRefreshRunTransition(
      missionId,
      {
        transitionFromRefreshRunId,
        transitionToRefreshRunId,
      },
    );

    return {
      missionId,
      artifact: buildAreaOverlayRefreshRunTransitionArtifact(
        missionId,
        transitionResult.transition,
      ),
    };
  }

  async listAreaOverlayRefreshRunTransitionArtifacts(
    missionId: string,
    filters: {
      refreshRunId?: string;
      fromRefreshRunId?: string;
      toRefreshRunId?: string;
      chronology?: boolean;
      transitionArtifact?: boolean;
      transitionFromRefreshRunId?: string;
      transitionToRefreshRunId?: string;
      transitionArtifactId?: string;
      transitionArtifactIds?: string[];
    },
  ): Promise<{
    missionId: string;
    chronology: AreaOverlayRefreshRunTransitionArtifactChronology;
  }> {
    if (
      filters.refreshRunId ||
      filters.fromRefreshRunId ||
      filters.toRefreshRunId ||
      filters.chronology ||
      filters.transitionArtifact ||
      filters.transitionFromRefreshRunId ||
      filters.transitionToRefreshRunId ||
      filters.transitionArtifactId
    ) {
      throw new MissionExternalOverlayRefreshRunTransitionArtifactChronologyQueryInvalidError(
        "transition artifact chronology queries cannot be combined with other refresh-run or transition artifact filters",
      );
    }

    const chronologyResult = await this.listAreaOverlayRefreshRunChronology(
      missionId,
    );
    const artifacts = chronologyResult.chronology.transitions.map((transition) =>
      buildAreaOverlayRefreshRunTransitionArtifact(missionId, transition),
    );

    if (filters.transitionArtifactIds && filters.transitionArtifactIds.length > 0) {
      for (const artifactId of filters.transitionArtifactIds) {
        const parsedArtifactId = parseAreaOverlayRefreshRunTransitionArtifactId(
          artifactId,
        );
        if (!parsedArtifactId) {
          throw new MissionExternalOverlayRefreshRunTransitionArtifactChronologyQueryInvalidError(
            "transitionArtifactIds entries must use the refresh_run_transition:<missionId>:<fromRefreshRunId>:<toRefreshRunId> format",
          );
        }

        if (parsedArtifactId.missionId !== missionId) {
          throw new MissionExternalOverlayRefreshRunTransitionArtifactChronologyQueryInvalidError(
            "transitionArtifactIds entries must match the requested mission",
          );
        }
      }

      const selectedArtifactIds = new Set(filters.transitionArtifactIds);
      return {
        missionId,
        chronology: {
          missionId,
          artifacts: artifacts.filter((artifact) =>
            selectedArtifactIds.has(artifact.artifactId),
          ),
        },
      };
    }

    return {
      missionId,
      chronology: {
        missionId,
        artifacts,
      },
    };
  }

  async listAreaOverlayRefreshRunChronology(
    missionId: string,
    filters: {
      refreshRunId?: string;
      fromRefreshRunId?: string;
      toRefreshRunId?: string;
    } = {},
  ): Promise<{ missionId: string; chronology: AreaOverlayRefreshRunChronology }> {
    if (filters.refreshRunId || filters.fromRefreshRunId || filters.toRefreshRunId) {
      throw new MissionExternalOverlayRefreshRunChronologyQueryInvalidError(
        "chronology queries cannot be combined with refreshRunId, fromRefreshRunId, or toRefreshRunId",
      );
    }

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
      const refreshRuns = buildAreaOverlayRefreshRunSummaries(missionId, overlays);
      const refreshRunOrder = buildRefreshRunOrder(overlays);
      const orderedRefreshRuns = [...refreshRuns].sort(
        (left, right) =>
          (refreshRunOrder.get(left.refreshRunId) ?? Number.MAX_SAFE_INTEGER) -
          (refreshRunOrder.get(right.refreshRunId) ?? Number.MAX_SAFE_INTEGER),
      );

      const transitions: AreaOverlayRefreshRunDiff[] = [];
      for (let index = 1; index < orderedRefreshRuns.length; index += 1) {
        transitions.push(
          buildAreaOverlayRefreshRunDiff(
            missionId,
            overlays,
            refreshRuns,
            refreshRunOrder,
            orderedRefreshRuns[index - 1].refreshRunId,
            orderedRefreshRuns[index].refreshRunId,
          ),
        );
      }

      return {
        missionId,
        chronology: {
          missionId,
          refreshRuns: orderedRefreshRuns,
          transitions,
        },
      };
    } finally {
      client.release();
    }
  }
}
