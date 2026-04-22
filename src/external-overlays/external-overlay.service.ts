import type { Pool } from "pg";
import { ExternalOverlayRepository } from "./external-overlay.repository";
import { MissionExternalOverlayMissionNotFoundError } from "./external-overlay.errors";
import type {
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

      const overlays: ExternalOverlay[] = [];
      for (const record of validated.records) {
        overlays.push(
          await this.externalOverlayRepository.insertAreaConflictOverlay(
            client,
            missionId,
            {
              kind: "area_conflict",
              source: record.source,
              observedAt: record.observedAt,
              validFrom: record.validFrom,
              validTo: record.validTo,
              geometry: record.geometry,
              severity: record.severity,
              confidence: record.confidence,
              freshnessSeconds: record.freshnessSeconds,
              metadata: {
                areaId: record.area.areaId,
                label: record.area.label,
                areaType: record.area.areaType,
                description: record.area.description ?? null,
                authorityName: record.area.authorityName ?? null,
                notamNumber: record.area.notamNumber ?? null,
                sourceReference: record.area.sourceReference ?? null,
              },
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
