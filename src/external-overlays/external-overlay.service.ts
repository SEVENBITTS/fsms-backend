import type { Pool } from "pg";
import { ExternalOverlayRepository } from "./external-overlay.repository";
import { MissionExternalOverlayMissionNotFoundError } from "./external-overlay.errors";
import type {
  CreateCrewedTrafficExternalOverlayInput,
  CreateDroneTrafficExternalOverlayInput,
  CreateWeatherExternalOverlayInput,
  ExternalOverlay,
  ExternalOverlayKind,
} from "./external-overlay.types";
import {
  validateCreateCrewedTrafficExternalOverlayInput,
  validateCreateDroneTrafficExternalOverlayInput,
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
