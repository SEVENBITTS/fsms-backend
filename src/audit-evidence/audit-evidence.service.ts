import type { Pool, PoolClient } from "pg";
import type { MissionReadinessCheck } from "../missions/mission-readiness.types";
import { MissionService } from "../missions/mission.service";
import {
  AuditEvidenceMissionNotCompletedError,
  AuditEvidenceMissionNotFoundError,
  AuditEvidenceSnapshotNotFoundError,
  PostOperationAuditSignoffAlreadyExistsError,
  PostOperationEvidenceSnapshotNotFoundError,
} from "./audit-evidence.errors";
import { AuditEvidenceRepository } from "./audit-evidence.repository";
import type {
  AuditEvidenceSnapshot,
  AuditEvidenceReadinessSnapshot,
  AuditReportSection,
  AuditReportSmsControlMapping,
  CreateAuditEvidenceSnapshotInput,
  CreateMissionDecisionEvidenceLinkInput,
  CreatePostOperationAuditSignoffInput,
  CreatePostOperationEvidenceSnapshotInput,
  MissionDecisionEvidenceLink,
  MissionLifecycleEvidenceEvent,
  PostOperationAuditSignoff,
  PostOperationCompletionSnapshot,
  PostOperationEvidenceExportPackage,
  PostOperationEvidencePdf,
  PostOperationEvidenceRenderedReport,
  PostOperationEvidenceSnapshot,
} from "./audit-evidence.types";
import {
  validateCreateAuditEvidenceSnapshotInput,
  validateCreateMissionDecisionEvidenceLinkInput,
  validateCreatePostOperationAuditSignoffInput,
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
    const readinessCheck = await this.missionService.checkMissionReadiness({
      missionId,
    });
    const client = await this.pool.connect();

    try {
      const smsControlMappings =
        await this.auditEvidenceRepository.listSmsControlMappingsForAuditReport(
          client,
        );
      const readinessSnapshot = this.buildReadinessEvidenceSnapshot(
        readinessCheck,
        smsControlMappings,
      );

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

      const safetyActionClosureEvidence =
        await this.auditEvidenceRepository
          .listSafetyActionClosureEvidenceForMissionExport(client, missionId);

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
        safetyActionClosureEvidence,
      };
    } finally {
      client.release();
    }
  }

  async renderPostOperationEvidenceSnapshot(
    missionId: string,
    snapshotId: string,
  ): Promise<PostOperationEvidenceRenderedReport> {
    const evidenceExport = await this.exportPostOperationEvidenceSnapshot(
      missionId,
      snapshotId,
    );
    const signoff = await this.getPostOperationAuditSignoff(
      evidenceExport.missionId,
      evidenceExport.snapshotId,
    );
    const smsControlMappings = await this.getSmsControlMappingsForAuditReport();
    const sections = this.buildPostOperationReportSections(
      evidenceExport,
      signoff,
      smsControlMappings,
    );

    return {
      renderType: "post_operation_completion_evidence_report",
      formatVersion: 1,
      generatedAt: new Date().toISOString(),
      sourceExport: evidenceExport,
      report: {
        title: `Post-operation completion evidence for mission ${evidenceExport.missionId}`,
        sections,
        plainText: this.renderSectionsAsPlainText(sections),
      },
    };
  }

  async generatePostOperationEvidencePdf(
    missionId: string,
    snapshotId: string,
  ): Promise<PostOperationEvidencePdf> {
    const renderedReport = await this.renderPostOperationEvidenceSnapshot(
      missionId,
      snapshotId,
    );
    const content = this.buildSimplePdf([
      renderedReport.report.title,
      "",
      renderedReport.report.plainText,
    ]);

    return {
      fileName: `mission-${missionId}-post-operation-evidence-${snapshotId}.pdf`,
      contentType: "application/pdf",
      content,
    };
  }

  async createPostOperationAuditSignoff(
    missionId: string,
    snapshotId: string,
    input: CreatePostOperationAuditSignoffInput | undefined,
  ): Promise<PostOperationAuditSignoff> {
    const validated = validateCreatePostOperationAuditSignoffInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

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

      const signoffExists =
        await this.auditEvidenceRepository.postOperationAuditSignoffExistsForSnapshot(
          client,
          snapshotId,
        );

      if (signoffExists) {
        throw new PostOperationAuditSignoffAlreadyExistsError(snapshotId);
      }

      const signoff =
        await this.auditEvidenceRepository.insertPostOperationAuditSignoff(
          client,
          {
            missionId,
            postOperationEvidenceSnapshotId: snapshot.id,
            accountableManagerName: validated.accountableManagerName,
            accountableManagerRole: validated.accountableManagerRole,
            reviewDecision: validated.reviewDecision,
            signedAt: validated.signedAt,
            signatureReference: validated.signatureReference,
            createdBy: validated.createdBy,
          },
        );

      await client.query("COMMIT");
      return signoff;
    } catch (error) {
      await client.query("ROLLBACK");
      if (this.isUniqueViolation(error)) {
        throw new PostOperationAuditSignoffAlreadyExistsError(snapshotId);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505"
    );
  }

  private async getPostOperationAuditSignoff(
    missionId: string,
    snapshotId: string,
  ): Promise<PostOperationAuditSignoff | null> {
    const client = await this.pool.connect();

    try {
      return await this.auditEvidenceRepository.getPostOperationAuditSignoffForSnapshot(
        client,
        missionId,
        snapshotId,
      );
    } finally {
      client.release();
    }
  }

  private async getSmsControlMappingsForAuditReport(): Promise<
    AuditReportSmsControlMapping[]
  > {
    const client = await this.pool.connect();

    try {
      return await this.auditEvidenceRepository.listSmsControlMappingsForAuditReport(
        client,
      );
    } finally {
      client.release();
    }
  }

  private buildReadinessEvidenceSnapshot(
    readinessCheck: MissionReadinessCheck,
    smsControlMappings: AuditReportSmsControlMapping[],
  ): AuditEvidenceReadinessSnapshot {
    return {
      ...readinessCheck,
      smsControlMappings,
    };
  }

  private async buildPostOperationCompletionSnapshot(
    client: PoolClient,
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

  private buildPostOperationReportSections(
    evidenceExport: PostOperationEvidenceExportPackage,
    signoff: PostOperationAuditSignoff | null,
    smsControlMappings: AuditReportSmsControlMapping[],
  ): AuditReportSection[] {
    const snapshot = evidenceExport.completionSnapshot;
    const pendingSignoff = "Pending sign-off";

    return [
      {
        heading: "Evidence package",
        fields: [
          { label: "Mission ID", value: evidenceExport.missionId },
          { label: "Snapshot ID", value: evidenceExport.snapshotId },
          { label: "Evidence type", value: evidenceExport.evidenceType },
          { label: "Lifecycle state", value: evidenceExport.lifecycleState },
          { label: "Snapshot created by", value: evidenceExport.createdBy },
          { label: "Snapshot created at", value: evidenceExport.createdAt },
          { label: "Export generated at", value: evidenceExport.generatedAt },
        ],
      },
      {
        heading: "Mission completion",
        fields: [
          { label: "Mission plan ID", value: snapshot.missionPlanId },
          { label: "Completion status", value: snapshot.status },
          { label: "Evidence captured at", value: snapshot.capturedAt },
          {
            label: "Completion event sequence",
            value: snapshot.completionEvent?.sequence ?? null,
          },
          {
            label: "Completion event summary",
            value: snapshot.completionEvent?.summary ?? null,
          },
        ],
      },
      {
        heading: "Approval evidence",
        fields: [
          {
            label: "Approval event sequence",
            value: snapshot.approvalEvent?.sequence ?? null,
          },
          {
            label: "Approval event actor",
            value: snapshot.approvalEvent?.actorId ?? null,
          },
          {
            label: "Approval evidence link ID",
            value: snapshot.approvalEvidenceLink?.id ?? null,
          },
          {
            label: "Planning handoff ID",
            value: snapshot.planningApprovalHandoff?.id ?? null,
          },
          {
            label: "Planning handoff ready",
            value:
              typeof snapshot.planningApprovalHandoff?.planningReview
                .readyForApproval === "boolean"
                ? snapshot.planningApprovalHandoff.planningReview
                    .readyForApproval
                : null,
          },
        ],
      },
      {
        heading: "Dispatch and launch evidence",
        fields: [
          {
            label: "Launch event sequence",
            value: snapshot.launchEvent?.sequence ?? null,
          },
          {
            label: "Launch event actor",
            value: snapshot.launchEvent?.actorId ?? null,
          },
          {
            label: "Dispatch evidence link ID",
            value: snapshot.dispatchEvidenceLink?.id ?? null,
          },
          {
            label: "Vehicle ID",
            value: this.getStringDetail(snapshot.launchEvent, "vehicle_id"),
          },
          {
            label: "Launch site",
            value: this.renderLaunchSite(snapshot.launchEvent),
          },
        ],
      },
      {
        heading: "Accountable manager sign-off",
        fields: [
          {
            label: "Accountable manager name",
            value: signoff?.accountableManagerName ?? pendingSignoff,
          },
          {
            label: "Role/title",
            value: signoff?.accountableManagerRole ?? pendingSignoff,
          },
          {
            label: "Signature",
            value: signoff?.signatureReference ?? pendingSignoff,
          },
          {
            label: "Signed date/time",
            value: signoff?.signedAt ?? pendingSignoff,
          },
          {
            label: "Review decision/status",
            value: signoff?.reviewDecision ?? pendingSignoff,
          },
          {
            label: "Sign-off record ID",
            value: signoff?.id ?? pendingSignoff,
          },
          {
            label: "Sign-off recorded by",
            value: signoff?.createdBy ?? pendingSignoff,
          },
          {
            label: "Sign-off recorded at",
            value: signoff?.createdAt ?? pendingSignoff,
          },
        ],
      },
      {
        heading: "Safety action closure evidence",
        fields:
          evidenceExport.safetyActionClosureEvidence.length > 0
            ? evidenceExport.safetyActionClosureEvidence.flatMap(
                (evidence, index) => [
                  {
                    label: `Closure ${index + 1} evidence category`,
                    value: evidence.evidenceCategory,
                  },
                  {
                    label: `Closure ${index + 1} implementation summary`,
                    value: evidence.implementationSummary,
                  },
                  {
                    label: `Closure ${index + 1} evidence reference`,
                    value: evidence.evidenceReference,
                  },
                  {
                    label: `Closure ${index + 1} completed by`,
                    value: evidence.completedBy,
                  },
                  {
                    label: `Closure ${index + 1} completed at`,
                    value: evidence.completedAt,
                  },
                  {
                    label: `Closure ${index + 1} reviewed by`,
                    value: evidence.reviewedBy,
                  },
                  {
                    label: `Closure ${index + 1} review notes`,
                    value: evidence.reviewNotes,
                  },
                  {
                    label: `Closure ${index + 1} safety event`,
                    value: `${evidence.eventType}: ${evidence.eventSummary}`,
                  },
                  {
                    label: `Closure ${index + 1} agenda item`,
                    value: evidence.agendaItem,
                  },
                  {
                    label: `Closure ${index + 1} action proposal`,
                    value: `${evidence.proposalType}: ${evidence.proposalSummary}`,
                  },
                  {
                    label: `Closure ${index + 1} action decisions`,
                    value: evidence.decisions
                      .map((decision) => decision.decision)
                      .join(", "),
                  },
                ],
              )
            : [
                {
                  label: "Safety action closure evidence",
                  value: "No safety action closure evidence recorded",
                },
              ],
      },
      {
        heading: "SMS assurance context",
        fields:
          smsControlMappings.length > 0
            ? smsControlMappings.map((mapping) => ({
                label: mapping.title,
                value:
                  mapping.smsElements.length > 0
                    ? mapping.smsElements.join("; ")
                    : "No SMS element mapping recorded",
              }))
            : [
                {
                  label: "SMS control mappings",
                  value: "No SMS control mappings recorded",
                },
              ],
      },
    ];
  }

  private renderSectionsAsPlainText(
    sections: AuditReportSection[],
  ): string {
    return sections
      .map((section) => {
        const fields = section.fields
          .map((field) => `${field.label}: ${field.value ?? "Not recorded"}`)
          .join("\n");

        return `${section.heading}\n${fields}`;
      })
      .join("\n\n");
  }

  private getStringDetail(
    event: MissionLifecycleEvidenceEvent | null,
    key: string,
  ): string | null {
    const value = event?.details[key];
    return typeof value === "string" ? value : null;
  }

  private renderLaunchSite(
    event: MissionLifecycleEvidenceEvent | null,
  ): string | null {
    const launchSite = event?.details.launch_site;

    if (
      !launchSite ||
      typeof launchSite !== "object" ||
      !("lat" in launchSite) ||
      !("lng" in launchSite)
    ) {
      return null;
    }

    const site = launchSite as { lat?: unknown; lng?: unknown };

    if (typeof site.lat !== "number" || typeof site.lng !== "number") {
      return null;
    }

    return `${site.lat}, ${site.lng}`;
  }

  private buildSimplePdf(blocks: string[]): Buffer {
    const lines = blocks
      .join("\n")
      .split("\n")
      .flatMap((line) => this.wrapPdfText(line, 92));
    const textCommands = lines
      .map((line, index) => {
        const operator = index === 0 ? "Td" : "T*";
        const leading = index === 0 ? "72 760" : "";
        return `${leading} ${operator} (${this.escapePdfText(line)}) Tj`.trim();
      })
      .join("\n");
    const stream = `BT\n/F1 10 Tf\n12 TL\n${textCommands}\nET`;
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf, "latin1"));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = Buffer.byteLength(pdf, "latin1");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    pdf += offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
      .join("");
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(pdf, "latin1");
  }

  private wrapPdfText(line: string, maxLength: number): string[] {
    if (line.length <= maxLength) {
      return [line];
    }

    const wrapped: string[] = [];
    let remaining = line;

    while (remaining.length > maxLength) {
      const breakAt = remaining.lastIndexOf(" ", maxLength);
      const splitAt = breakAt > 0 ? breakAt : maxLength;
      wrapped.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }

    wrapped.push(remaining);
    return wrapped;
  }

  private escapePdfText(value: string): string {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  }
}
