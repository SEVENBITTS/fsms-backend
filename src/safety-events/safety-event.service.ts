import type { Pool } from "pg";
import {
  SafetyEventReferenceNotFoundError,
} from "./safety-event.errors";
import { SafetyEventRepository } from "./safety-event.repository";
import type {
  CreateSafetyEventInput,
  SafetyEvent,
} from "./safety-event.types";
import { validateCreateSafetyEventInput } from "./safety-event.validators";

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
