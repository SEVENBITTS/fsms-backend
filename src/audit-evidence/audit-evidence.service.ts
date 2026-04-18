import type { Pool } from "pg";
import { MissionService } from "../missions/mission.service";
import {
  AuditEvidenceMissionNotCompletedError,
  AuditEvidenceMissionNotFoundError,
  AuditEvidenceSnapshotNotFoundError,
  PostOperationEvidenceSnapshotNotFoundError,
} from "./audit-evidence.errors";
import { AuditEvidenceRepository } from "./audit-evidence.repository";
import type {
  AuditEvidenceSnapshot,
  CreateAuditEvidenceSnapshotInput,
  CreateMissionDecisionEvidenceLinkInput,
  CreatePostOperationEvidenceSnapshotInput,
  MissionDecisionEvidenceLink,
  MissionLifecycleEvidenceEvent,
  PostOperationCompletionSnapshot,
  PostOperationEvidenceExportPackage,
  PostOperationEvidenceSnapshot,
} from "./audit-evidence.types";
import {
  validateCreateAuditEvidenceSnapshotInput,
  validateCreateMissionDecisionEvidenceLinkInput,
  validateCreatePostOperationEvidenceSnapshotInput,
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

  async createPostOperationEvidenceSnapshot(
    missionId: string,
    input: CreatePostOperationEvidenceSnapshotInput | undefined,
  ): Promise<PostOperationEvidenceSnapshot> {
    const validated = validateCreatePostOperationEvidenceSnapshotInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const mission = await this.auditEvidenceRepository.getMissionAuditState(
        client,
        missionId,
      );

      if (!mission) {
        throw new AuditEvidenceMissionNotFoundError(missionId);
      }

      if (mission.status !== "completed") {
        throw new AuditEvidenceMissionNotCompletedError(
          missionId,
          mission.status,
        );
      }

      const completionSnapshot =
        await this.buildPostOperationCompletionSnapshot(client, {
          missionId: mission.id,
          missionPlanId: mission.mission_plan_id,
          status: mission.status,
        });

      const snapshot =
        await this.auditEvidenceRepository.insertPostOperationEvidenceSnapshot(
          client,
          {
            missionId,
            lifecycleState: mission.status,
            completionSnapshot,
            createdBy: validated.createdBy,
          },
        );

      await client.query("COMMIT");
      return snapshot;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listPostOperationEvidenceSnapshots(
    missionId: string,
  ): Promise<PostOperationEvidenceSnapshot[]> {
    const client = await this.pool.connect();

    try {
      const exists = await this.auditEvidenceRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new AuditEvidenceMissionNotFoundError(missionId);
      }

      return await this.auditEvidenceRepository.listPostOperationEvidenceSnapshots(
        client,
        missionId,
      );
    } finally {
      client.release();
    }
  }

  async exportPostOperationEvidenceSnapshot(
    missionId: string,
    snapshotId: string,
  ): Promise<PostOperationEvidenceExportPackage> {
    const client = await this.pool.connect();

    try {
      const exists = await this.auditEvidenceRepository.missionExists(
        client,
        missionId,
      );

      if (!exists) {
        throw new AuditEvidenceMissionNotFoundError(missionId);
      }

      const snapshot =
        await this.auditEvidenceRepository.getPostOperationEvidenceSnapshotForMission(
          client,
          missionId,
          snapshotId,
        );

      if (!snapshot) {
        throw new PostOperationEvidenceSnapshotNotFoundError(snapshotId);
      }

      return {
        exportType: "post_operation_completion_evidence",
        formatVersion: 1,
        generatedAt: new Date().toISOString(),
        missionId: snapshot.missionId,
        snapshotId: snapshot.id,
        evidenceType: snapshot.evidenceType,
        lifecycleState: snapshot.lifecycleState,
        createdBy: snapshot.createdBy,
        createdAt: snapshot.createdAt,
        completionSnapshot: snapshot.completionSnapshot,
      };
    } finally {
      client.release();
    }
  }

  private async buildPostOperationCompletionSnapshot(
    client: Awaited<ReturnType<Pool["connect"]>>,
    mission: { missionId: string; missionPlanId: string | null; status: string },
  ): Promise<PostOperationCompletionSnapshot> {
    const events =
      await this.auditEvidenceRepository.getLifecycleEvidenceEvents(
        client,
        mission.missionId,
      );
    const approvalEvent = this.findLastEvent(events, "mission.approved");
    const launchEvent = this.findLastEvent(events, "mission.launched");
    const completionEvent = this.findLastEvent(events, "mission.completed");
    const approvalEvidenceLinkId = this.extractDecisionEvidenceLinkId(
      approvalEvent,
    );
    const dispatchEvidenceLinkId = this.extractDecisionEvidenceLinkId(
      launchEvent,
    );
    const approvalEvidenceLink =
      await this.auditEvidenceRepository.getDecisionEvidenceLinkById(
        client,
        mission.missionId,
        approvalEvidenceLinkId,
      );
    const dispatchEvidenceLink =
      await this.auditEvidenceRepository.getDecisionEvidenceLinkById(
        client,
        mission.missionId,
        dispatchEvidenceLinkId,
      );
    const planningApprovalHandoff =
      await this.auditEvidenceRepository.getPlanningApprovalHandoffForDecisionLink(
        client,
        mission.missionId,
        approvalEvidenceLinkId,
      );

    return {
      missionId: mission.missionId,
      missionPlanId: mission.missionPlanId,
      status: mission.status,
      capturedAt: new Date().toISOString(),
      approvalEvent,
      launchEvent,
      completionEvent,
      approvalEvidenceLink,
      dispatchEvidenceLink,
      planningApprovalHandoff,
    };
  }

  private findLastEvent(
    events: MissionLifecycleEvidenceEvent[],
    eventType: string,
  ): MissionLifecycleEvidenceEvent | null {
    return (
      [...events].reverse().find((event) => event.type === eventType) ?? null
    );
  }

  private extractDecisionEvidenceLinkId(
    event: MissionLifecycleEvidenceEvent | null,
  ): string | null {
    const linkId = event?.details.decision_evidence_link_id;
    return typeof linkId === "string" && linkId.trim().length > 0
      ? linkId
      : null;
  }
}
