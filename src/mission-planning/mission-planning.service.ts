import type { Pool } from "pg";
import { AirspaceComplianceRepository } from "../airspace-compliance/airspace-compliance.repository";
import { validateCreateAirspaceComplianceInput } from "../airspace-compliance/airspace-compliance.validators";
import { AuditEvidenceService } from "../audit-evidence/audit-evidence.service";
import type { AuditReportSmsControlMapping } from "../audit-evidence/audit-evidence.types";
import { MissionRiskRepository } from "../mission-risk/mission-risk.repository";
import { validateCreateMissionRiskInput } from "../mission-risk/mission-risk.validators";
import { MissionService } from "../missions/mission.service";
import {
  MissionPlanningDraftNotFoundError,
  MissionPlanningMissionNotFoundError,
  MissionPlanningReferenceNotFoundError,
  MissionPlanningReviewNotReadyError,
} from "./mission-planning.errors";
import { MissionPlanningRepository } from "./mission-planning.repository";
import type {
  CreateMissionPlanningApprovalHandoffInput,
  CreateMissionPlanningDraftInput,
  MissionPlanningApprovalHandoff,
  MissionPlanningApprovalHandoffTrace,
  MissionPlanningDraft,
  MissionPlanningChecklistItem,
  MissionPlanningReview,
  MissionPlanningWorkspace,
  MissionPlanningWorkspaceNextAction,
  UpdateMissionPlanningDraftInput,
} from "./mission-planning.types";
import {
  validateCreateMissionPlanningApprovalHandoffInput,
  validateCreateMissionPlanningDraftInput,
  validateUpdateMissionPlanningDraftInput,
} from "./mission-planning.validators";

export class MissionPlanningService {
  private static readonly LIFECYCLE_ACTIONS = [
    "submit",
    "approve",
    "launch",
    "complete",
    "abort",
  ] as const;

  constructor(
    private readonly pool: Pool,
    private readonly missionPlanningRepository: MissionPlanningRepository,
    private readonly missionRiskRepository: MissionRiskRepository,
    private readonly airspaceComplianceRepository: AirspaceComplianceRepository,
    private readonly auditEvidenceService: AuditEvidenceService,
    private readonly missionService: MissionService,
  ) {}

  async createDraft(
    input: CreateMissionPlanningDraftInput | undefined,
  ): Promise<MissionPlanningDraft> {
    const validated = validateCreateMissionPlanningDraftInput(input);
    const riskInput = validated.riskInput
      ? validateCreateMissionRiskInput(validated.riskInput)
      : null;
    const airspaceInput = validated.airspaceInput
      ? validateCreateAirspaceComplianceInput(validated.airspaceInput)
      : null;
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      if (
        validated.platformId &&
        !(await this.missionPlanningRepository.platformExists(
          client,
          validated.platformId,
        ))
      ) {
        throw new MissionPlanningReferenceNotFoundError(
          `Platform not found: ${validated.platformId}`,
        );
      }

      if (
        validated.pilotId &&
        !(await this.missionPlanningRepository.pilotExists(
          client,
          validated.pilotId,
        ))
      ) {
        throw new MissionPlanningReferenceNotFoundError(
          `Pilot not found: ${validated.pilotId}`,
        );
      }

      const missionId =
        await this.missionPlanningRepository.insertDraftMission(client, {
          missionPlanId: validated.missionPlanId,
          platformId: validated.platformId,
          pilotId: validated.pilotId,
        });

      if (riskInput) {
        await this.missionRiskRepository.insertMissionRiskInput(client, {
          missionId,
          ...riskInput,
        });
      }

      if (airspaceInput) {
        await this.airspaceComplianceRepository.insertAirspaceComplianceInput(
          client,
          {
            missionId,
            ...airspaceInput,
          },
        );
      }

      const draft = await this.getDraftForClient(client, missionId);
      await client.query("COMMIT");
      return draft;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getDraft(missionId: string): Promise<MissionPlanningDraft> {
    const client = await this.pool.connect();

    try {
      return await this.getDraftForClient(client, missionId);
    } finally {
      client.release();
    }
  }

  async updateDraft(
    missionId: string,
    input: UpdateMissionPlanningDraftInput | undefined,
  ): Promise<MissionPlanningDraft> {
    const validated = validateUpdateMissionPlanningDraftInput(input);
    const riskInput = validated.riskInput
      ? validateCreateMissionRiskInput(validated.riskInput)
      : null;
    const airspaceInput = validated.airspaceInput
      ? validateCreateAirspaceComplianceInput(validated.airspaceInput)
      : null;
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await this.getDraftForClient(client, missionId);

      if (
        validated.platformId.provided &&
        validated.platformId.value &&
        !(await this.missionPlanningRepository.platformExists(
          client,
          validated.platformId.value,
        ))
      ) {
        throw new MissionPlanningReferenceNotFoundError(
          `Platform not found: ${validated.platformId.value}`,
        );
      }

      if (
        validated.pilotId.provided &&
        validated.pilotId.value &&
        !(await this.missionPlanningRepository.pilotExists(
          client,
          validated.pilotId.value,
        ))
      ) {
        throw new MissionPlanningReferenceNotFoundError(
          `Pilot not found: ${validated.pilotId.value}`,
        );
      }

      const placeholderUpdates: {
        missionPlanId?: string | null;
        platformId?: string | null;
        pilotId?: string | null;
      } = {};

      if (validated.missionPlanId.provided) {
        placeholderUpdates.missionPlanId = validated.missionPlanId.value;
      }

      if (validated.platformId.provided) {
        placeholderUpdates.platformId = validated.platformId.value;
      }

      if (validated.pilotId.provided) {
        placeholderUpdates.pilotId = validated.pilotId.value;
      }

      const updated =
        await this.missionPlanningRepository.updateDraftMissionPlaceholders(
          client,
          missionId,
          placeholderUpdates,
        );

      if (!updated) {
        throw new MissionPlanningDraftNotFoundError(missionId);
      }

      if (riskInput) {
        await this.missionRiskRepository.insertMissionRiskInput(client, {
          missionId,
          ...riskInput,
        });
      }

      if (airspaceInput) {
        await this.airspaceComplianceRepository.insertAirspaceComplianceInput(
          client,
          {
            missionId,
            ...airspaceInput,
          },
        );
      }

      const draft = await this.getDraftForClient(client, missionId);
      await client.query("COMMIT");
      return draft;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async reviewDraft(missionId: string): Promise<MissionPlanningReview> {
    const draft = await this.getDraft(missionId);
    const blockingReasons = draft.checklist
      .filter((item) => item.status === "missing")
      .map((item) => item.message);

    return {
      missionId: draft.missionId,
      missionPlanId: draft.missionPlanId,
      status: draft.status,
      platformId: draft.platformId,
      pilotId: draft.pilotId,
      readyForApproval: blockingReasons.length === 0,
      blockingReasons,
      checklist: draft.checklist,
    };
  }

  async getWorkspace(missionId: string): Promise<MissionPlanningWorkspace> {
    const client = await this.pool.connect();

    try {
      const mission = await this.missionPlanningRepository.getMissionWorkspaceMission(
        client,
        missionId,
      );

      if (!mission) {
        throw new MissionPlanningMissionNotFoundError(missionId);
      }

      const latestApprovalHandoffRow =
        await this.missionPlanningRepository.getLatestApprovalHandoffTrace(
          client,
          missionId,
        );

      const [
        readiness,
        readinessSnapshots,
        decisionEvidenceLinks,
        nextAllowedActions,
      ] = await Promise.all([
        this.missionService.checkMissionReadiness({ missionId }),
        this.auditEvidenceService.listMissionReadinessSnapshots(missionId),
        this.auditEvidenceService.listMissionDecisionEvidenceLinks(missionId),
        Promise.all(
          MissionPlanningService.LIFECYCLE_ACTIONS.map((action) =>
            this.missionService.checkMissionTransition({ missionId, action }),
          ),
        ),
      ]);

      const placeholders = {
        platformAssigned: mission.platform_id !== null,
        pilotAssigned: mission.pilot_id !== null,
        riskInputPresent: mission.risk_input_present,
        airspaceInputPresent: mission.airspace_input_present,
      };
      const checklist = this.buildChecklist(placeholders);
      const missingRequirements = checklist
        .filter((item) => item.status === "missing")
        .map((item) => item.message);
      const readinessBlockingReasons = readiness.reasons
        .filter((reason) => reason.severity !== "pass")
        .map((reason) => reason.message);
      const approvalBlockingReasons = Array.from(
        new Set([...missingRequirements, ...readinessBlockingReasons]),
      );
      const launchTransition = nextAllowedActions.find(
        (action) => action.action === "launch",
      );
      const dispatchBlockingReasons = Array.from(
        new Set([
          ...(launchTransition?.allowed === false && launchTransition.error
            ? [launchTransition.error.message]
            : []),
          ...(
            readiness.gate.blocksDispatch || readiness.gate.requiresReview
              ? readinessBlockingReasons
              : []
          ),
        ]),
      );

      return {
        mission: {
          id: mission.id,
          missionPlanId: mission.mission_plan_id,
          status: mission.status,
          platformId: mission.platform_id,
          pilotId: mission.pilot_id,
          lastEventSequenceNo: Number(mission.last_event_sequence_no),
        },
        planning: {
          status: mission.status,
          missionPlanId: mission.mission_plan_id,
          platformId: mission.platform_id,
          pilotId: mission.pilot_id,
          placeholders,
          checklist,
          readyForApproval: approvalBlockingReasons.length === 0,
          blockingReasons: approvalBlockingReasons,
        },
        platform: {
          assignedPlatformId: mission.platform_id,
          state: this.getLinkedEntityState(
            mission.platform_id,
            readiness.platformReadiness !== null,
          ),
          summary: readiness.platformReadiness?.maintenanceStatus.platform ?? null,
        },
        pilot: {
          assignedPilotId: mission.pilot_id,
          state: this.getLinkedEntityState(
            mission.pilot_id,
            readiness.pilotReadiness !== null,
          ),
          summary: readiness.pilotReadiness?.readinessStatus.pilot ?? null,
        },
        missionRisk: readiness.missionRisk,
        airspaceCompliance: readiness.airspaceCompliance,
        readiness,
        evidence: {
          readinessSnapshotCount: readinessSnapshots.length,
          latestReadinessSnapshot: readinessSnapshots[0] ?? null,
          approvalEvidenceLinkCount: decisionEvidenceLinks.filter(
            (link) => link.decisionType === "approval",
          ).length,
          latestApprovalEvidenceLink:
            decisionEvidenceLinks.find(
              (link) => link.decisionType === "approval",
            ) ?? null,
          dispatchEvidenceLinkCount: decisionEvidenceLinks.filter(
            (link) => link.decisionType === "dispatch",
          ).length,
          latestDispatchEvidenceLink:
            decisionEvidenceLinks.find(
              (link) => link.decisionType === "dispatch",
            ) ?? null,
        },
        approval: {
          ready: approvalBlockingReasons.length === 0,
          handoffCreated: latestApprovalHandoffRow !== null,
          latestApprovalHandoff: latestApprovalHandoffRow
            ? this.toApprovalHandoffTrace(latestApprovalHandoffRow)
            : null,
          blockingReasons: approvalBlockingReasons,
        },
        dispatch: {
          ready: dispatchBlockingReasons.length === 0,
          blockingReasons: dispatchBlockingReasons,
        },
        missingRequirements,
        blockingReasons: approvalBlockingReasons,
        nextAllowedActions: nextAllowedActions.map(
          (action): MissionPlanningWorkspaceNextAction => ({
            action: action.action,
            currentStatus: action.currentStatus,
            targetStatus: action.targetStatus,
            allowed: action.allowed,
            error: action.error,
          }),
        ),
      };
    } finally {
      client.release();
    }
  }

  async createApprovalHandoff(
    missionId: string,
    input: CreateMissionPlanningApprovalHandoffInput | undefined,
  ): Promise<MissionPlanningApprovalHandoff> {
    const validated = validateCreateMissionPlanningApprovalHandoffInput(input);
    const review = await this.reviewDraft(missionId);

    if (!review.readyForApproval) {
      throw new MissionPlanningReviewNotReadyError(review.blockingReasons);
    }

    const snapshot =
      await this.auditEvidenceService.createMissionReadinessSnapshot(missionId, {
        createdBy: validated.createdBy,
      });
    const approvalEvidenceLink =
      await this.auditEvidenceService.createMissionDecisionEvidenceLink(
        missionId,
        {
          snapshotId: snapshot.id,
          decisionType: "approval",
          createdBy: validated.createdBy,
        },
      );
    await this.recordApprovalHandoffTrace({
      missionId,
      snapshotId: snapshot.id,
      approvalEvidenceLinkId: approvalEvidenceLink.id,
      review,
      createdBy: validated.createdBy,
    });

    return {
      review,
      snapshot,
      approvalEvidenceLink,
      smsControlMappings:
        this.getSmsControlMappingsFromReadinessSnapshot(snapshot),
    };
  }

  private getSmsControlMappingsFromReadinessSnapshot(
    snapshot: MissionPlanningApprovalHandoff["snapshot"],
  ): AuditReportSmsControlMapping[] {
    return snapshot.readinessSnapshot.smsControlMappings ?? [];
  }

  private async recordApprovalHandoffTrace(input: {
    missionId: string;
    snapshotId: string;
    approvalEvidenceLinkId: string;
    review: MissionPlanningReview;
    createdBy: string | null;
  }): Promise<void> {
    const client = await this.pool.connect();

    try {
      await this.missionPlanningRepository.insertApprovalHandoffTrace(
        client,
        input,
      );
    } finally {
      client.release();
    }
  }

  private async getDraftForClient(
    client: Parameters<MissionPlanningRepository["getDraftMission"]>[0],
    missionId: string,
  ): Promise<MissionPlanningDraft> {
    const row = await this.missionPlanningRepository.getDraftMission(
      client,
      missionId,
    );

    if (!row) {
      throw new MissionPlanningDraftNotFoundError(missionId);
    }

    return this.toDraft(row);
  }

  private toApprovalHandoffTrace(row: {
    id: string;
    mission_id: string;
    audit_evidence_snapshot_id: string;
    mission_decision_evidence_link_id: string;
    planning_review: MissionPlanningReview;
    created_by: string | null;
    created_at: string;
  }): MissionPlanningApprovalHandoffTrace {
    return {
      id: row.id,
      missionId: row.mission_id,
      auditEvidenceSnapshotId: row.audit_evidence_snapshot_id,
      missionDecisionEvidenceLinkId: row.mission_decision_evidence_link_id,
      planningReview: row.planning_review,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  private getLinkedEntityState(
    assignedId: string | null,
    hasLoadedSummary: boolean,
  ): "assigned" | "missing" | "not_found" {
    if (!assignedId) {
      return "missing";
    }

    return hasLoadedSummary ? "assigned" : "not_found";
  }

  private toDraft(row: {
    id: string;
    status: "draft";
    mission_plan_id: string | null;
    platform_id: string | null;
    pilot_id: string | null;
    risk_input_present: boolean;
    airspace_input_present: boolean;
  }): MissionPlanningDraft {
    const placeholders = {
      platformAssigned: row.platform_id !== null,
      pilotAssigned: row.pilot_id !== null,
      riskInputPresent: row.risk_input_present,
      airspaceInputPresent: row.airspace_input_present,
    };
    const checklist = this.buildChecklist(placeholders);

    return {
      missionId: row.id,
      missionPlanId: row.mission_plan_id,
      status: row.status,
      platformId: row.platform_id,
      pilotId: row.pilot_id,
      placeholders,
      checklist,
      readinessCheckAvailable: checklist.every(
        (item) => item.status === "present",
      ),
    };
  }

  private buildChecklist(placeholders: {
    platformAssigned: boolean;
    pilotAssigned: boolean;
    riskInputPresent: boolean;
    airspaceInputPresent: boolean;
  }): MissionPlanningChecklistItem[] {
    return [
      {
        key: "platform",
        status: placeholders.platformAssigned ? "present" : "missing",
        message: placeholders.platformAssigned
          ? "Platform assignment placeholder is present"
          : "Assign a platform before readiness can pass",
      },
      {
        key: "pilot",
        status: placeholders.pilotAssigned ? "present" : "missing",
        message: placeholders.pilotAssigned
          ? "Pilot assignment placeholder is present"
          : "Assign a pilot before readiness can pass",
      },
      {
        key: "risk",
        status: placeholders.riskInputPresent ? "present" : "missing",
        message: placeholders.riskInputPresent
          ? "Mission risk input placeholder is present"
          : "Add mission risk inputs before readiness can pass",
      },
      {
        key: "airspace",
        status: placeholders.airspaceInputPresent ? "present" : "missing",
        message: placeholders.airspaceInputPresent
          ? "Airspace compliance input placeholder is present"
          : "Add airspace compliance inputs before readiness can pass",
      },
    ];
  }
}
