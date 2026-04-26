import type { Pool } from "pg";
import { AirspaceComplianceRepository } from "../airspace-compliance/airspace-compliance.repository";
import { validateCreateAirspaceComplianceInput } from "../airspace-compliance/airspace-compliance.validators";
import { AuditEvidenceService } from "../audit-evidence/audit-evidence.service";
import type { AuditReportSmsControlMapping } from "../audit-evidence/audit-evidence.types";
import { MissionRiskRepository } from "../mission-risk/mission-risk.repository";
import { validateCreateMissionRiskInput } from "../mission-risk/mission-risk.validators";
import { MissionService } from "../missions/mission.service";
import { MissionTelemetryRepository } from "../missions/mission-telemetry.repository";
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
  MissionDispatchWorkspace,
  MissionOperationsTelemetrySummary,
  MissionOperationsTimeline,
  MissionOperationsTimelineItem,
  MissionOperationsTimelinePhase,
  MissionOperationsTimelinePhaseStatus,
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

type MissionWorkspaceContext = {
  mission: {
    id: string;
    status: string;
    mission_plan_id: string | null;
    platform_id: string | null;
    pilot_id: string | null;
    last_event_sequence_no: number;
    risk_input_present: boolean;
    airspace_input_present: boolean;
  };
  latestApprovalHandoff: MissionPlanningApprovalHandoffTrace | null;
  readiness: Awaited<ReturnType<MissionService["checkMissionReadiness"]>>;
  readinessSnapshots: Awaited<
    ReturnType<AuditEvidenceService["listMissionReadinessSnapshots"]>
  >;
  decisionEvidenceLinks: Awaited<
    ReturnType<AuditEvidenceService["listMissionDecisionEvidenceLinks"]>
  >;
  nextAllowedActions: Awaited<
    ReturnType<MissionService["checkMissionTransition"]>
  >[];
  placeholders: {
    platformAssigned: boolean;
    pilotAssigned: boolean;
    riskInputPresent: boolean;
    airspaceInputPresent: boolean;
  };
  checklist: MissionPlanningChecklistItem[];
  missingRequirements: string[];
  readinessBlockingReasons: string[];
};

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
    private readonly missionTelemetryRepository: MissionTelemetryRepository,
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
    const context = await this.getMissionWorkspaceContext(missionId);
    const {
      mission,
      latestApprovalHandoff,
      readiness,
      readinessSnapshots,
      decisionEvidenceLinks,
      nextAllowedActions,
      placeholders,
      checklist,
      missingRequirements,
      readinessBlockingReasons,
    } = context;
    const latestApprovalEvidenceLink =
      decisionEvidenceLinks.find((link) => link.decisionType === "approval") ??
      null;
    const latestDispatchEvidenceLink =
      decisionEvidenceLinks.find((link) => link.decisionType === "dispatch") ??
      null;
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
        ...(readiness.gate.blocksDispatch || readiness.gate.requiresReview
          ? readinessBlockingReasons
          : []),
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
        latestApprovalEvidenceLink,
        dispatchEvidenceLinkCount: decisionEvidenceLinks.filter(
          (link) => link.decisionType === "dispatch",
        ).length,
        latestDispatchEvidenceLink,
      },
      approval: {
        ready: approvalBlockingReasons.length === 0,
        handoffCreated: latestApprovalHandoff !== null,
        latestApprovalHandoff,
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
  }

  async getDispatchWorkspace(missionId: string): Promise<MissionDispatchWorkspace> {
    const context = await this.getMissionWorkspaceContext(missionId);
    const {
      mission,
      latestApprovalHandoff,
      readiness,
      readinessSnapshots,
      decisionEvidenceLinks,
      nextAllowedActions,
      readinessBlockingReasons,
    } = context;
    const latestApprovalEvidenceLink =
      decisionEvidenceLinks.find((link) => link.decisionType === "approval") ??
      null;
    const latestDispatchEvidenceLink =
      decisionEvidenceLinks.find((link) => link.decisionType === "dispatch") ??
      null;
    const launchTransition = nextAllowedActions.find(
      (action) => action.action === "launch",
    );

    if (!launchTransition) {
      throw new Error("Launch transition preflight was not produced");
    }

    const dispatchMissingRequirements: string[] = [];

    if (!latestApprovalHandoff) {
      dispatchMissingRequirements.push(
        "Create planning approval handoff before dispatch",
      );
    }

    if (!latestApprovalEvidenceLink) {
      dispatchMissingRequirements.push(
        "Link approval evidence before dispatch",
      );
    }

    if (!latestDispatchEvidenceLink) {
      dispatchMissingRequirements.push(
        "Create linked dispatch evidence before launch",
      );
    }

    const approvalBlockingReasons = Array.from(
      new Set([
        ...(mission.status === "approved" ||
        mission.status === "active" ||
        mission.status === "completed"
          ? []
          : ["Mission must be approved before launch can proceed"]),
        ...(latestApprovalHandoff
          ? []
          : ["Planning approval handoff is not recorded for this mission"]),
        ...(latestApprovalEvidenceLink
          ? []
          : ["Approval evidence link is not recorded for this mission"]),
      ]),
    );
    const dispatchBlockingReasons = Array.from(
      new Set([
        ...(launchTransition.allowed || !launchTransition.error
          ? []
          : [launchTransition.error.message]),
        ...approvalBlockingReasons,
        ...dispatchMissingRequirements,
        ...(readiness.gate.blocksDispatch || readiness.gate.requiresReview
          ? readinessBlockingReasons
          : []),
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
        latestApprovalEvidenceLink,
        dispatchEvidenceLinkCount: decisionEvidenceLinks.filter(
          (link) => link.decisionType === "dispatch",
        ).length,
        latestDispatchEvidenceLink,
      },
      approval: {
        currentStatus: mission.status,
        approvedForDispatch:
          mission.status === "approved" ||
          mission.status === "active" ||
          mission.status === "completed",
        handoffCreated: latestApprovalHandoff !== null,
        latestApprovalHandoff,
        latestApprovalEvidenceLink,
        blockingReasons: approvalBlockingReasons,
      },
      dispatch: {
        ready: dispatchBlockingReasons.length === 0,
        latestDispatchEvidenceLink,
        launchPreflight: {
          action: launchTransition.action,
          currentStatus: launchTransition.currentStatus,
          targetStatus: launchTransition.targetStatus,
          allowed: launchTransition.allowed,
          error: launchTransition.error,
        },
        blockingReasons: dispatchBlockingReasons,
        missingRequirements: dispatchMissingRequirements,
      },
      blockingReasons: dispatchBlockingReasons,
      nextAllowedActions: nextAllowedActions
        .filter(
          (action) =>
            action.action === "launch" ||
            action.action === "complete" ||
            action.action === "abort",
        )
        .map((action): MissionPlanningWorkspaceNextAction => ({
          action: action.action,
          currentStatus: action.currentStatus,
          targetStatus: action.targetStatus,
          allowed: action.allowed,
          error: action.error,
      })),
    };
  }

  async getOperationsTimeline(
    missionId: string,
  ): Promise<MissionOperationsTimeline> {
    const context = await this.getMissionWorkspaceContext(missionId);
    const {
      mission,
      decisionEvidenceLinks,
    } = context;
    const client = await this.pool.connect();

    try {
      const lifecycleEvents = await this.missionService.getMissionEvents(
        missionId,
        {},
      );
      const planningHandoffs =
        await this.missionPlanningRepository.listApprovalHandoffTraces(
          client,
          missionId,
        );
      const riskInputs =
        await this.missionPlanningRepository.listMissionRiskInputTimelineRows(
          client,
          missionId,
        );
      const airspaceInputs =
        await this.missionPlanningRepository.listAirspaceInputTimelineRows(
          client,
          missionId,
        );
      const telemetrySummary =
        await this.missionTelemetryRepository.getTimelineSummaryByMissionId(
          missionId,
          client,
        );
      const postOperationSnapshots =
        await this.auditEvidenceService.listPostOperationEvidenceSnapshots(
          missionId,
        );

      const items: MissionOperationsTimelineItem[] = [
        ...riskInputs.map((input) => ({
          id: `planning-risk-${input.id}`,
          phase: "planning" as const,
          type: "planning_risk_input" as const,
          occurredAt: input.created_at,
          source: "mission-risk-service",
          summary: `Mission risk input recorded (${input.operating_category}/${input.mission_complexity})`,
          details: {
            id: input.id,
            operatingCategory: input.operating_category,
            missionComplexity: input.mission_complexity,
            populationExposure: input.population_exposure,
            airspaceComplexity: input.airspace_complexity,
            weatherRisk: input.weather_risk,
            payloadRisk: input.payload_risk,
            mitigationSummary: input.mitigation_summary,
          },
        })),
        ...airspaceInputs.map((input) => ({
          id: `planning-airspace-${input.id}`,
          phase: "planning" as const,
          type: "planning_airspace_input" as const,
          occurredAt: input.created_at,
          source: "airspace-compliance-service",
          summary: `Airspace input recorded (${input.airspace_class.toUpperCase()} / ${input.permission_status})`,
          details: {
            id: input.id,
            airspaceClass: input.airspace_class,
            maxAltitudeFt: Number(input.max_altitude_ft),
            restrictionStatus: input.restriction_status,
            permissionStatus: input.permission_status,
            controlledAirspace: input.controlled_airspace,
            nearbyAerodrome: input.nearby_aerodrome,
            evidenceRef: input.evidence_ref,
            notes: input.notes,
          },
        })),
        ...planningHandoffs.map((handoff) => ({
          id: `planning-handoff-${handoff.id}`,
          phase: "planning" as const,
          type: "planning_approval_handoff" as const,
          occurredAt: handoff.created_at,
          source: "mission-planning-service",
          summary: "Planning approval handoff recorded",
          details: {
            id: handoff.id,
            auditEvidenceSnapshotId: handoff.audit_evidence_snapshot_id,
            missionDecisionEvidenceLinkId: handoff.mission_decision_evidence_link_id,
            planningReview: handoff.planning_review,
            createdBy: handoff.created_by,
          },
        })),
        ...decisionEvidenceLinks.map((link) => ({
          id: `decision-evidence-${link.id}`,
          phase: link.decisionType === "approval" ? ("approval" as const) : ("dispatch" as const),
          type: "decision_evidence_link" as const,
          occurredAt: link.createdAt,
          source: "audit-evidence-service",
          summary:
            link.decisionType === "approval"
              ? "Approval evidence linked"
              : "Dispatch evidence linked",
          details: {
            id: link.id,
            decisionType: link.decisionType,
            auditEvidenceSnapshotId: link.auditEvidenceSnapshotId,
            createdBy: link.createdBy,
          },
        })),
        ...lifecycleEvents.map((event) => ({
          id: `mission-event-${event.id}`,
          phase: this.getLifecyclePhase(event.type),
          type: "mission_event" as const,
          occurredAt: event.time,
          source: event.type,
          summary: event.summary,
          details: {
            id: event.id,
            sequence: event.sequence,
            eventType: event.type,
            actorType: event.actorType,
            actorId: event.actorId,
            fromState: event.fromState,
            toState: event.toState,
            details: event.details,
          },
        })),
        ...(telemetrySummary.recordCount > 0 && telemetrySummary.lastRecordedAt
          ? [
              {
                id: `telemetry-summary-${mission.id}`,
                phase: "flight" as const,
                type: "telemetry_summary" as const,
                occurredAt: telemetrySummary.lastRecordedAt.toISOString(),
                source: "mission-telemetry-service",
                summary: `Telemetry recorded (${telemetrySummary.recordCount} records)`,
                details: {
                  recordCount: telemetrySummary.recordCount,
                  firstRecordedAt:
                    telemetrySummary.firstRecordedAt?.toISOString() ?? null,
                  lastRecordedAt:
                    telemetrySummary.lastRecordedAt?.toISOString() ?? null,
                  latestRecord: telemetrySummary.latestRecord
                    ? {
                        timestamp: telemetrySummary.latestRecord.recordedAt.toISOString(),
                        lat: telemetrySummary.latestRecord.lat,
                        lng: telemetrySummary.latestRecord.lng,
                        altitudeM: telemetrySummary.latestRecord.altitudeM,
                        speedMps: telemetrySummary.latestRecord.speedMps,
                        headingDeg: telemetrySummary.latestRecord.headingDeg,
                        progressPct: telemetrySummary.latestRecord.progressPct,
                        payload: telemetrySummary.latestRecord.payload,
                      }
                    : null,
                },
              },
            ]
          : []),
        ...postOperationSnapshots.map((snapshot) => ({
          id: `post-operation-${snapshot.id}`,
          phase: "post_operation" as const,
          type: "post_operation_snapshot" as const,
          occurredAt: snapshot.createdAt,
          source: "audit-evidence-service",
          summary: "Post-operation evidence snapshot recorded",
          details: {
            id: snapshot.id,
            evidenceType: snapshot.evidenceType,
            lifecycleState: snapshot.lifecycleState,
            createdBy: snapshot.createdBy,
            completionSnapshot: snapshot.completionSnapshot,
          },
        })),
      ].sort((left, right) => this.compareTimelineItems(left, right));

      return {
        mission: {
          id: mission.id,
          missionPlanId: mission.mission_plan_id,
          status: mission.status,
          platformId: mission.platform_id,
          pilotId: mission.pilot_id,
          lastEventSequenceNo: Number(mission.last_event_sequence_no),
        },
        phases: this.buildTimelinePhaseStatuses(items, telemetrySummary),
        items,
      };
    } finally {
      client.release();
    }
  }

  private async getMissionWorkspaceContext(
    missionId: string,
  ): Promise<MissionWorkspaceContext> {
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

      return {
        mission,
        latestApprovalHandoff: latestApprovalHandoffRow
          ? this.toApprovalHandoffTrace(latestApprovalHandoffRow)
          : null,
        readiness,
        readinessSnapshots,
        decisionEvidenceLinks,
        nextAllowedActions,
        placeholders,
        checklist,
        missingRequirements,
        readinessBlockingReasons,
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

  private getLifecyclePhase(eventType: string): MissionOperationsTimelinePhase {
    if (eventType === "mission.approved") {
      return "approval";
    }

    if (eventType === "mission.launched" || eventType === "mission.aborted") {
      return "dispatch";
    }

    if (eventType === "mission.completed") {
      return "post_operation";
    }

    return "approval";
  }

  private compareTimelineItems(
    left: MissionOperationsTimelineItem,
    right: MissionOperationsTimelineItem,
  ): number {
    const byTime =
      new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();

    if (byTime !== 0) {
      return byTime;
    }

    const phaseRank = this.getPhaseRank(left.phase) - this.getPhaseRank(right.phase);

    if (phaseRank !== 0) {
      return phaseRank;
    }

    return left.id.localeCompare(right.id);
  }

  private getPhaseRank(phase: MissionOperationsTimelinePhase): number {
    switch (phase) {
      case "planning":
        return 0;
      case "approval":
        return 1;
      case "dispatch":
        return 2;
      case "flight":
        return 3;
      case "post_operation":
        return 4;
      default:
        return 99;
    }
  }

  private buildTimelinePhaseStatuses(
    items: MissionOperationsTimelineItem[],
    telemetrySummary: {
      recordCount: number;
      firstRecordedAt: Date | null;
      lastRecordedAt: Date | null;
      latestRecord: unknown;
    },
  ): MissionOperationsTimelinePhaseStatus[] {
    return ([
      "planning",
      "approval",
      "dispatch",
      "flight",
      "post_operation",
    ] as MissionOperationsTimelinePhase[]).map((phase) => {
      const phaseItems = items.filter((item) => item.phase === phase);
      const latestAt =
        phaseItems.length > 0
          ? phaseItems[phaseItems.length - 1].occurredAt
          : null;

      if (phase === "flight" && telemetrySummary.recordCount === 0 && phaseItems.length === 0) {
        return {
          phase,
          status: "missing",
          latestAt: null,
          summary: "No telemetry or flight-phase evidence recorded",
        };
      }

      return {
        phase,
        status: phaseItems.length > 0 ? "present" : "missing",
        latestAt,
        summary:
          phaseItems.length > 0
            ? `${phaseItems.length} ${phase.replace("_", " ")} timeline item(s) recorded`
            : `No ${phase.replace("_", " ")} timeline items recorded`,
      };
    });
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
