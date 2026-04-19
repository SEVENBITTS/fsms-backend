import type { Pool } from "pg";
import {
  SafetyEventNotFoundError,
  SafetyEventReferenceNotFoundError,
} from "./safety-event.errors";
import { SafetyEventRepository } from "./safety-event.repository";
import type {
  AssessSafetyEventMeetingTriggerInput,
  CreateSafetyEventInput,
  SafetyEvent,
  SafetyEventMeetingTrigger,
  SafetyEventMeetingTriggerReviewFlags,
  SafetyEventMeetingType,
} from "./safety-event.types";
import {
  validateAssessMeetingTriggerInput,
  validateCreateSafetyEventInput,
  validateSafetyEventId,
} from "./safety-event.validators";

export class SafetyEventService {
  constructor(
    private readonly pool: Pool,
    private readonly safetyEventRepository: SafetyEventRepository,
  ) {}

  async createSafetyEvent(
    input: CreateSafetyEventInput | undefined,
  ): Promise<SafetyEvent> {
    const validated = validateCreateSafetyEventInput(input);
    const client = await this.pool.connect();

    try {
      await this.validateReferences(client, validated);
      return await this.safetyEventRepository.insertSafetyEvent(
        client,
        validated,
      );
    } finally {
      client.release();
    }
  }

  async listSafetyEvents(): Promise<SafetyEvent[]> {
    const client = await this.pool.connect();

    try {
      return await this.safetyEventRepository.listSafetyEvents(client);
    } finally {
      client.release();
    }
  }

  async assessMeetingTrigger(
    eventIdInput: unknown,
    input: AssessSafetyEventMeetingTriggerInput | undefined,
  ): Promise<SafetyEventMeetingTrigger> {
    const eventId = validateSafetyEventId(eventIdInput);
    const validated = validateAssessMeetingTriggerInput(input);
    const client = await this.pool.connect();

    try {
      const event = await this.safetyEventRepository.getSafetyEventById(
        client,
        eventId,
      );

      if (!event) {
        throw new SafetyEventNotFoundError(eventId);
      }

      const assessment = this.buildMeetingTriggerAssessment(event);

      return await this.safetyEventRepository.insertSafetyEventMeetingTrigger(
        client,
        {
          safetyEventId: event.id,
          assessedBy: validated.assessedBy,
          ...assessment,
        },
      );
    } finally {
      client.release();
    }
  }

  async listMeetingTriggers(
    eventIdInput: unknown,
  ): Promise<SafetyEventMeetingTrigger[]> {
    const eventId = validateSafetyEventId(eventIdInput);
    const client = await this.pool.connect();

    try {
      const event = await this.safetyEventRepository.getSafetyEventById(
        client,
        eventId,
      );

      if (!event) {
        throw new SafetyEventNotFoundError(eventId);
      }

      return await this.safetyEventRepository.listSafetyEventMeetingTriggers(
        client,
        eventId,
      );
    } finally {
      client.release();
    }
  }

  private buildMeetingTriggerAssessment(event: SafetyEvent): {
    meetingRequired: boolean;
    recommendedMeetingType: SafetyEventMeetingType | null;
    triggerReasons: string[];
    reviewFlags: SafetyEventMeetingTriggerReviewFlags;
  } {
    const triggerReasons: string[] = [];
    const reviewFlags: SafetyEventMeetingTriggerReviewFlags = {
      sopReviewRequired: event.sopReviewRequired,
      trainingRequired: event.trainingRequired,
      maintenanceReviewRequired: event.maintenanceReviewRequired,
      accountableManagerReviewRequired: event.accountableManagerReviewRequired,
      regulatorReportableReviewRequired: event.regulatorReportableReviewRequired,
    };

    if (event.severity === "high" || event.severity === "critical") {
      triggerReasons.push(`severity:${event.severity}`);
    }

    if (event.eventType === "sop_breach") {
      triggerReasons.push("event_type:sop_breach");
      reviewFlags.sopReviewRequired = true;
    }

    if (event.eventType === "training_need") {
      triggerReasons.push("event_type:training_need");
      reviewFlags.trainingRequired = true;
    }

    if (event.eventType === "maintenance_concern") {
      triggerReasons.push("event_type:maintenance_concern");
      reviewFlags.maintenanceReviewRequired = true;
    }

    if (event.meetingRequired) {
      triggerReasons.push("existing_flag:meeting_required");
    }

    if (event.sopReviewRequired) {
      triggerReasons.push("existing_flag:sop_review_required");
    }

    if (event.trainingRequired) {
      triggerReasons.push("existing_flag:training_required");
    }

    if (event.maintenanceReviewRequired) {
      triggerReasons.push("existing_flag:maintenance_review_required");
    }

    if (event.accountableManagerReviewRequired) {
      triggerReasons.push(
        "existing_flag:accountable_manager_review_required",
      );
    }

    if (event.regulatorReportableReviewRequired) {
      triggerReasons.push(
        "existing_flag:regulator_reportable_review_required",
      );
    }

    const meetingRequired = triggerReasons.length > 0;

    return {
      meetingRequired,
      recommendedMeetingType: meetingRequired
        ? this.getRecommendedMeetingType(event, reviewFlags)
        : null,
      triggerReasons,
      reviewFlags,
    };
  }

  private getRecommendedMeetingType(
    event: SafetyEvent,
    reviewFlags: SafetyEventMeetingTriggerReviewFlags,
  ): SafetyEventMeetingType {
    if (
      reviewFlags.accountableManagerReviewRequired ||
      event.severity === "critical"
    ) {
      return "accountable_manager_review";
    }

    if (reviewFlags.maintenanceReviewRequired) {
      return "maintenance_safety_review";
    }

    if (reviewFlags.sopReviewRequired) {
      return "sop_breach_review";
    }

    if (reviewFlags.trainingRequired) {
      return "training_review";
    }

    return "event_triggered_safety_review";
  }

  private async validateReferences(
    client: Awaited<ReturnType<Pool["connect"]>>,
    input: ReturnType<typeof validateCreateSafetyEventInput>,
  ): Promise<void> {
    await this.validateReference(client, "missions", input.missionId, "mission");
    await this.validateReference(
      client,
      "platforms",
      input.platformId,
      "platform",
    );
    await this.validateReference(client, "pilots", input.pilotId, "pilot");
    await this.validateReference(
      client,
      "post_operation_evidence_snapshots",
      input.postOperationEvidenceSnapshotId,
      "post-operation evidence snapshot",
    );
    await this.validateReference(
      client,
      "air_safety_meetings",
      input.airSafetyMeetingId,
      "air safety meeting",
    );
  }

  private async validateReference(
    client: Awaited<ReturnType<Pool["connect"]>>,
    tableName:
      | "missions"
      | "platforms"
      | "pilots"
      | "post_operation_evidence_snapshots"
      | "air_safety_meetings",
    id: string | null,
    label: string,
  ): Promise<void> {
    if (!id) {
      return;
    }

    const exists = await this.safetyEventRepository.referenceExists(
      client,
      tableName,
      id,
    );

    if (!exists) {
      throw new SafetyEventReferenceNotFoundError(
        `Safety event references missing ${label}: ${id}`,
      );
    }
  }
}
