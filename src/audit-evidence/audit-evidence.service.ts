import type { Pool } from "pg";
import { MissionService } from "../missions/mission.service";
import {
  AuditEvidenceMissionNotFoundError,
  AuditEvidenceSnapshotNotFoundError,
} from "./audit-evidence.errors";
import { AuditEvidenceRepository } from "./audit-evidence.repository";
import type {
  AuditEvidenceSnapshot,
  CreateAuditEvidenceSnapshotInput,
  CreateMissionDecisionEvidenceLinkInput,
  MissionDecisionEvidenceLink,
} from "./audit-evidence.types";
import {
  validateCreateAuditEvidenceSnapshotInput,
  validateCreateMissionDecisionEvidenceLinkInput,
} from "./audit-evidence.validators";

export class AuditEvidenceService {
  constructor(
    private readonly pool: Pool,
    private readonly auditEvidenceRepository: AuditEvidenceRepository,
    private readonly missionService: MissionService,
  ) {}

  async createMissionReadinessSnapshot(
    missionId: string,
    input: CreateAuditEvidenceSnapshotInput | undefined,
  ): Promise<AuditEvidenceSnapshot> {
    const validated = validateCreateAuditEvidenceSnapshotInput(input);
    const readinessSnapshot = await this.missionService.checkMissionReadiness({
      missionId,
    });
    const client = await this.pool.connect();

    try {
      return await this.auditEvidenceRepository.insertReadinessSnapshot(client, {
        missionId,
        readinessSnapshot,
        createdBy: validated.createdBy,
      });
    } finally {
      client.release();
    }
  }

  async listMissionReadinessSnapshots(
    missionId: string,
  ): Promise<AuditEvidenceSnapshot[]> {
    const client = await this.pool.connect();

    try {
      const exists = await this.auditEvidenceRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new AuditEvidenceMissionNotFoundError(missionId);
      }

      return await this.auditEvidenceRepository.listReadinessSnapshots(
        client,
        missionId,
      );
    } finally {
      client.release();
    }
  }

  async createMissionDecisionEvidenceLink(
    missionId: string,
    input: CreateMissionDecisionEvidenceLinkInput | undefined,
  ): Promise<MissionDecisionEvidenceLink> {
    const validated = validateCreateMissionDecisionEvidenceLinkInput(input);
    const client = await this.pool.connect();

    try {
      const exists = await this.auditEvidenceRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new AuditEvidenceMissionNotFoundError(missionId);
      }

      const snapshotExists =
        await this.auditEvidenceRepository.snapshotExistsForMission(
          client,
          missionId,
          validated.snapshotId,
        );

      if (!snapshotExists) {
        throw new AuditEvidenceSnapshotNotFoundError(validated.snapshotId);
      }

      return await this.auditEvidenceRepository.insertDecisionEvidenceLink(
        client,
        {
          missionId,
          snapshotId: validated.snapshotId,
          decisionType: validated.decisionType,
          createdBy: validated.createdBy,
        },
      );
    } finally {
      client.release();
    }
  }

  async listMissionDecisionEvidenceLinks(
    missionId: string,
  ): Promise<MissionDecisionEvidenceLink[]> {
    const client = await this.pool.connect();

    try {
      const exists = await this.auditEvidenceRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new AuditEvidenceMissionNotFoundError(missionId);
      }

      return await this.auditEvidenceRepository.listDecisionEvidenceLinks(
        client,
        missionId,
      );
    } finally {
      client.release();
    }
  }
}
