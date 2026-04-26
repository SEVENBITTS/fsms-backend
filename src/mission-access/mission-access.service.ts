import type { Pool } from "pg";
import {
  MissionAccessMissionNotFoundError,
  MissionAccessOrganisationMissingError,
} from "./mission-access.errors";
import {
  MissionAccessRepository,
  type MissionAccessContext,
} from "./mission-access.repository";

export class MissionAccessService {
  constructor(
    private readonly pool: Pool,
    private readonly missionAccessRepository: MissionAccessRepository,
  ) {}

  async getMissionContext(missionId: string): Promise<MissionAccessContext> {
    const client = await this.pool.connect();

    try {
      const mission = await this.missionAccessRepository.getMissionContext(
        client,
        missionId,
      );

      if (!mission) {
        throw new MissionAccessMissionNotFoundError(missionId);
      }

      return mission;
    } finally {
      client.release();
    }
  }

  async getMissionOrganisationId(missionId: string): Promise<string> {
    const mission = await this.getMissionContext(missionId);

    if (!mission.organisationId) {
      throw new MissionAccessOrganisationMissingError(missionId);
    }

    return mission.organisationId;
  }
}
