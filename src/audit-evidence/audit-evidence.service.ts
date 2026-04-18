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
  AuditReportSection,
  CreateAuditEvidenceSnapshotInput,
  CreateMissionDecisionEvidenceLinkInput,
  CreatePostOperationEvidenceSnapshotInput,
  MissionDecisionEvidenceLink,
  MissionLifecycleEvidenceEvent,
  PostOperationCompletionSnapshot,
  PostOperationEvidenceExportPackage,
  PostOperationEvidencePdf,
  PostOperationEvidenceRenderedReport,
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

  async renderPostOperationEvidenceSnapshot(
    missionId: string,
    snapshotId: string,
  ): Promise<PostOperationEvidenceRenderedReport> {
    const evidenceExport = await this.exportPostOperationEvidenceSnapshot(
      missionId,
      snapshotId,
    );
    const sections = this.buildPostOperationReportSections(evidenceExport);

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

  private buildPostOperationReportSections(
    evidenceExport: PostOperationEvidenceExportPackage,
  ): AuditReportSection[] {
    const snapshot = evidenceExport.completionSnapshot;

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
          { label: "Accountable manager name", value: "Pending sign-off" },
          { label: "Role/title", value: "Pending sign-off" },
          { label: "Signature", value: "Pending sign-off" },
          { label: "Signed date/time", value: "Pending sign-off" },
          { label: "Review decision/status", value: "Pending sign-off" },
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
