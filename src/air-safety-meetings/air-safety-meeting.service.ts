import type { Pool } from "pg";
import { AirSafetyMeetingNotFoundError } from "./air-safety-meeting.errors";
import { AirSafetyMeetingRepository } from "./air-safety-meeting.repository";
import type {
  AirSafetyMeeting,
  AirSafetyMeetingApprovalRollupExport,
  AirSafetyMeetingApprovalRollupSummary,
  AirSafetyMeetingApprovalRollupSummaryRenderedReport,
  AirSafetyMeetingApprovalRollupSummaryPdf,
  AirSafetyMeetingApprovalRollupPdf,
  AirSafetyMeetingApprovalRollupRecord,
  AirSafetyMeetingApprovalRollupRenderedReport,
  AirSafetyMeetingSignoff,
  CreateGovernanceApprovalRollupSignoffInput,
  GovernanceApprovalRollupSignoff,
  AirSafetyMeetingPackExportActionProposal,
  AirSafetyMeetingPackExportAgendaItem,
  AirSafetyMeetingPackExport,
  AirSafetyMeetingPackPdf,
  AirSafetyMeetingPackRenderedReport,
  AirSafetyMeetingReportSection,
  CreateAirSafetyMeetingInput,
  CreateAirSafetyMeetingSignoffInput,
  QuarterlyAirSafetyMeetingCompliance,
  QuarterlyComplianceStatus,
} from "./air-safety-meeting.types";
import {
  validateAirSafetyMeetingId,
  validateCreateAirSafetyMeetingInput,
  validateCreateGovernanceApprovalRollupSignoffInput,
  validateCreateAirSafetyMeetingSignoffInput,
  validateQuarterlyComplianceQuery,
} from "./air-safety-meeting.validators";

const QUARTERLY_REQUIREMENT_MONTHS = 3;
const DUE_SOON_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export class AirSafetyMeetingService {
  constructor(
    private readonly pool: Pool,
    private readonly airSafetyMeetingRepository: AirSafetyMeetingRepository,
  ) {}

  async createAirSafetyMeeting(
    input: CreateAirSafetyMeetingInput | undefined,
  ): Promise<AirSafetyMeeting> {
    const validated = validateCreateAirSafetyMeetingInput(input);
    const client = await this.pool.connect();

    try {
      return await this.airSafetyMeetingRepository.insertAirSafetyMeeting(
        client,
        validated,
      );
    } finally {
      client.release();
    }
  }

  async listAirSafetyMeetings(): Promise<AirSafetyMeeting[]> {
    const client = await this.pool.connect();

    try {
      return await this.airSafetyMeetingRepository.listAirSafetyMeetings(client);
    } finally {
      client.release();
    }
  }

  async exportAirSafetyMeetingApprovalRollup(): Promise<AirSafetyMeetingApprovalRollupExport> {
    const client = await this.pool.connect();

    try {
      const [records, governanceSignoff] = await Promise.all([
        this.airSafetyMeetingRepository.listAirSafetyMeetingApprovalRollup(client),
        this.airSafetyMeetingRepository.getLatestGovernanceApprovalRollupSignoff(
          client,
        ),
      ]);

      return {
        exportType: "air_safety_meeting_approval_rollup",
        formatVersion: 1,
        generatedAt: new Date().toISOString(),
        governanceSignoffApproval: {
          status: governanceSignoff?.reviewDecision ?? "unsigned",
          latestSignoff: governanceSignoff,
        },
        records,
      };
    } finally {
      client.release();
    }
  }

  async renderAirSafetyMeetingApprovalRollup(): Promise<AirSafetyMeetingApprovalRollupRenderedReport> {
    const rollupExport = await this.exportAirSafetyMeetingApprovalRollup();
    const sections = this.buildApprovalRollupReportSections(
      rollupExport,
      rollupExport.governanceSignoffApproval.latestSignoff,
    );

    return {
      renderType: "air_safety_meeting_approval_rollup_report",
      formatVersion: 1,
      generatedAt: new Date().toISOString(),
      sourceExport: rollupExport,
      report: {
        title: "Air safety meeting approval assurance summary",
        sections,
        plainText: this.renderSectionsAsPlainText(sections),
      },
    };
  }

  async summarizeAirSafetyMeetingApprovalRollup(): Promise<AirSafetyMeetingApprovalRollupSummary> {
    const rollupExport = await this.exportAirSafetyMeetingApprovalRollup();
    const approvedMeetings = rollupExport.records.filter(
      (record) => record.latestSignoffApprovalStatus === "approved",
    );
    const rejectedMeetings = rollupExport.records.filter(
      (record) => record.latestSignoffApprovalStatus === "rejected",
    );
    const requiresFollowUpMeetings = rollupExport.records.filter(
      (record) => record.latestSignoffApprovalStatus === "requires_follow_up",
    );
    const unsignedMeetings = rollupExport.records.filter(
      (record) => record.latestSignoffApprovalStatus === "unsigned",
    );

    return {
      summaryType: "air_safety_meeting_approval_rollup_summary",
      formatVersion: 1,
      generatedAt: new Date().toISOString(),
      governanceSignoffApproval: rollupExport.governanceSignoffApproval,
      counts: {
        total: rollupExport.records.length,
        approved: approvedMeetings.length,
        rejected: rejectedMeetings.length,
        requiresFollowUp: requiresFollowUpMeetings.length,
        unsigned: unsignedMeetings.length,
      },
      approvedMeetings,
      rejectedMeetings,
      requiresFollowUpMeetings,
      unsignedMeetings,
    };
  }

  async renderAirSafetyMeetingApprovalRollupSummary(): Promise<AirSafetyMeetingApprovalRollupSummaryRenderedReport> {
    const summary = await this.summarizeAirSafetyMeetingApprovalRollup();
    const sections = this.buildApprovalRollupSummaryReportSections(summary);

    return {
      renderType: "air_safety_meeting_approval_rollup_summary_report",
      formatVersion: 1,
      generatedAt: new Date().toISOString(),
      sourceSummary: summary,
      report: {
        title: "Governance summary approval assurance report",
        sections,
        plainText: this.renderSectionsAsPlainText(sections),
      },
    };
  }

  async generateAirSafetyMeetingApprovalRollupSummaryPdf(): Promise<AirSafetyMeetingApprovalRollupSummaryPdf> {
    const renderedReport = await this.renderAirSafetyMeetingApprovalRollupSummary();
    const content = this.buildSimplePdf([
      renderedReport.report.title,
      "",
      renderedReport.report.plainText,
    ]);

    return {
      fileName: "air-safety-meeting-approval-rollup-summary.pdf",
      contentType: "application/pdf",
      content,
    };
  }

  async generateAirSafetyMeetingApprovalRollupPdf(): Promise<AirSafetyMeetingApprovalRollupPdf> {
    const renderedReport = await this.renderAirSafetyMeetingApprovalRollup();
    const content = this.buildSimplePdf([
      renderedReport.report.title,
      "",
      renderedReport.report.plainText,
    ]);

    return {
      fileName: "air-safety-meeting-approval-rollup.pdf",
      contentType: "application/pdf",
      content,
    };
  }

  async createAirSafetyMeetingSignoff(
    meetingIdInput: unknown,
    input: CreateAirSafetyMeetingSignoffInput | undefined,
  ): Promise<AirSafetyMeetingSignoff> {
    const meetingId = validateAirSafetyMeetingId(meetingIdInput);
    const validated = validateCreateAirSafetyMeetingSignoffInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const meeting = await this.airSafetyMeetingRepository.getAirSafetyMeetingById(
        client,
        meetingId,
      );

      if (!meeting) {
        throw new AirSafetyMeetingNotFoundError(meetingId);
      }

      const signoff = await this.airSafetyMeetingRepository
        .insertAirSafetyMeetingSignoff(client, {
          airSafetyMeetingId: meetingId,
          accountableManagerName: validated.accountableManagerName,
          accountableManagerRole: validated.accountableManagerRole,
          reviewDecision: validated.reviewDecision,
          signedAt: validated.signedAt,
          signatureReference: validated.signatureReference,
          reviewNotes: validated.reviewNotes,
          createdBy: validated.createdBy,
        });

      await client.query("COMMIT");
      return signoff;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createGovernanceApprovalRollupSignoff(
    input: CreateGovernanceApprovalRollupSignoffInput | undefined,
  ): Promise<GovernanceApprovalRollupSignoff> {
    const validated = validateCreateGovernanceApprovalRollupSignoffInput(input);
    const client = await this.pool.connect();

    try {
      return await this.airSafetyMeetingRepository
        .insertGovernanceApprovalRollupSignoff(client, validated);
    } finally {
      client.release();
    }
  }

  async listAirSafetyMeetingSignoffs(
    meetingIdInput: unknown,
  ): Promise<AirSafetyMeetingSignoff[]> {
    const meetingId = validateAirSafetyMeetingId(meetingIdInput);
    const client = await this.pool.connect();

    try {
      const meeting = await this.airSafetyMeetingRepository.getAirSafetyMeetingById(
        client,
        meetingId,
      );

      if (!meeting) {
        throw new AirSafetyMeetingNotFoundError(meetingId);
      }

      return await this.airSafetyMeetingRepository.listAirSafetyMeetingSignoffs(
        client,
        meetingId,
      );
    } finally {
      client.release();
    }
  }

  async listGovernanceApprovalRollupSignoffs(): Promise<
    GovernanceApprovalRollupSignoff[]
  > {
    const client = await this.pool.connect();

    try {
      return await this.airSafetyMeetingRepository
        .listGovernanceApprovalRollupSignoffs(client);
    } finally {
      client.release();
    }
  }

  async getQuarterlyCompliance(input: {
    asOf?: unknown;
  }): Promise<QuarterlyAirSafetyMeetingCompliance> {
    const asOf = validateQuarterlyComplianceQuery(input);
    const client = await this.pool.connect();

    try {
      const lastCompletedMeeting =
        await this.airSafetyMeetingRepository.getLatestCompletedQuarterlyMeeting(
          client,
          asOf,
        );

      return this.buildQuarterlyCompliance(asOf, lastCompletedMeeting);
    } finally {
      client.release();
    }
  }

  async exportAirSafetyMeetingPack(
    meetingIdInput: unknown,
  ): Promise<AirSafetyMeetingPackExport> {
    const meetingId = validateAirSafetyMeetingId(meetingIdInput);
    const client = await this.pool.connect();

    try {
      const meeting = await this.airSafetyMeetingRepository
        .getAirSafetyMeetingById(client, meetingId);

      if (!meeting) {
        throw new AirSafetyMeetingNotFoundError(meetingId);
      }

      const signoff = await this.airSafetyMeetingRepository
        .getLatestAirSafetyMeetingSignoff(client, meetingId);
      const agendaItems = await this.airSafetyMeetingRepository
        .listAirSafetyMeetingPackAgendaItems(client, meetingId);

      return {
        exportType: "air_safety_meeting_pack",
        formatVersion: 1,
        generatedAt: new Date().toISOString(),
        meetingId,
        meeting,
        signoffApproval: {
          status: signoff?.reviewDecision ?? "unsigned",
          latestSignoff: signoff,
        },
        agendaItems,
      };
    } finally {
      client.release();
    }
  }

  async renderAirSafetyMeetingPack(
    meetingIdInput: unknown,
  ): Promise<AirSafetyMeetingPackRenderedReport> {
    const meetingExport = await this.exportAirSafetyMeetingPack(meetingIdInput);
    const signoff = await this.getLatestAirSafetyMeetingSignoff(
      meetingExport.meetingId,
    );
    const sections = this.buildMeetingPackReportSections(meetingExport, signoff);

    return {
      renderType: "air_safety_meeting_pack_report",
      formatVersion: 1,
      generatedAt: new Date().toISOString(),
      sourceExport: meetingExport,
      report: {
        title: `Air safety meeting pack for meeting ${meetingExport.meetingId}`,
        sections,
        plainText: this.renderSectionsAsPlainText(sections),
      },
    };
  }

  async generateAirSafetyMeetingPackPdf(
    meetingIdInput: unknown,
  ): Promise<AirSafetyMeetingPackPdf> {
    const renderedReport = await this.renderAirSafetyMeetingPack(meetingIdInput);
    const content = this.buildSimplePdf([
      renderedReport.report.title,
      "",
      renderedReport.report.plainText,
    ]);

    return {
      fileName: `air-safety-meeting-${renderedReport.sourceExport.meetingId}-pack.pdf`,
      contentType: "application/pdf",
      content,
    };
  }

  private buildQuarterlyCompliance(
    asOf: Date,
    lastCompletedMeeting: AirSafetyMeeting | null,
  ): QuarterlyAirSafetyMeetingCompliance {
    if (!lastCompletedMeeting?.heldAt) {
      return {
        status: "overdue",
        requirement: "quarterly_air_safety_meeting",
        requirementMonths: QUARTERLY_REQUIREMENT_MONTHS,
        dueSoonWindowDays: DUE_SOON_WINDOW_DAYS,
        asOf: asOf.toISOString(),
        lastCompletedMeeting: null,
        nextDueAt: null,
        message:
          "No completed quarterly air safety meeting is recorded; the quarterly requirement is overdue",
      };
    }

    const nextDueAt = this.addUtcMonths(
      new Date(lastCompletedMeeting.heldAt),
      QUARTERLY_REQUIREMENT_MONTHS,
    );
    const status = this.getQuarterlyComplianceStatus(asOf, nextDueAt);

    return {
      status,
      requirement: "quarterly_air_safety_meeting",
      requirementMonths: QUARTERLY_REQUIREMENT_MONTHS,
      dueSoonWindowDays: DUE_SOON_WINDOW_DAYS,
      asOf: asOf.toISOString(),
      lastCompletedMeeting,
      nextDueAt: nextDueAt.toISOString(),
      message: this.getQuarterlyComplianceMessage(status, nextDueAt),
    };
  }

  private getQuarterlyComplianceStatus(
    asOf: Date,
    nextDueAt: Date,
  ): QuarterlyComplianceStatus {
    if (nextDueAt.getTime() < asOf.getTime()) {
      return "overdue";
    }

    const daysUntilDue = Math.ceil(
      (nextDueAt.getTime() - asOf.getTime()) / DAY_MS,
    );

    if (daysUntilDue <= DUE_SOON_WINDOW_DAYS) {
      return "due_soon";
    }

    return "compliant";
  }

  private getQuarterlyComplianceMessage(
    status: QuarterlyComplianceStatus,
    nextDueAt: Date,
  ): string {
    if (status === "overdue") {
      return `Quarterly air safety meeting is overdue; next due date was ${nextDueAt.toISOString()}`;
    }

    if (status === "due_soon") {
      return `Quarterly air safety meeting is due soon by ${nextDueAt.toISOString()}`;
    }

    return `Quarterly air safety meeting requirement is compliant until ${nextDueAt.toISOString()}`;
  }

  private addUtcMonths(value: Date, months: number): Date {
    const result = new Date(value.getTime());
    result.setUTCMonth(result.getUTCMonth() + months);
    return result;
  }

  private buildApprovalRollupReportSections(
    rollupExport: AirSafetyMeetingApprovalRollupExport,
    governanceSignoff: GovernanceApprovalRollupSignoff | null,
  ): AirSafetyMeetingReportSection[] {
    const records = rollupExport.records;
    const pendingSignoff = "Pending sign-off";
    const statuses: Array<AirSafetyMeetingApprovalRollupRecord["latestSignoffApprovalStatus"]> = [
      "approved",
      "rejected",
      "requires_follow_up",
      "unsigned",
    ];

    const sections: AirSafetyMeetingReportSection[] = [
      {
        heading: "Approval rollup summary",
        fields: [
          { label: "Export generated at", value: rollupExport.generatedAt },
          { label: "Total meetings", value: records.length },
          {
            label: "Approved meetings",
            value: records.filter(
              (record) => record.latestSignoffApprovalStatus === "approved",
            ).length,
          },
          {
            label: "Rejected meetings",
            value: records.filter(
              (record) => record.latestSignoffApprovalStatus === "rejected",
            ).length,
          },
          {
            label: "Requires follow-up meetings",
            value: records.filter(
              (record) =>
                record.latestSignoffApprovalStatus === "requires_follow_up",
            ).length,
          },
          {
            label: "Unsigned meetings",
            value: records.filter(
              (record) => record.latestSignoffApprovalStatus === "unsigned",
            ).length,
          },
        ],
      },
      {
        heading: "Accountable manager sign-off",
        fields: [
          {
            label: "Accountable manager name",
            value: governanceSignoff?.accountableManagerName ?? pendingSignoff,
          },
          {
            label: "Role/title",
            value: governanceSignoff?.accountableManagerRole ?? pendingSignoff,
          },
          {
            label: "Signature",
            value: governanceSignoff?.signatureReference ?? pendingSignoff,
          },
          {
            label: "Signed date/time",
            value: governanceSignoff?.signedAt ?? pendingSignoff,
          },
          {
            label: "Review decision/status",
            value: governanceSignoff?.reviewDecision ?? pendingSignoff,
          },
          {
            label: "Review notes/comments",
            value: governanceSignoff?.reviewNotes ?? pendingSignoff,
          },
        ],
      },
    ];

    if (records.length === 0) {
      sections.push({
        heading: "Approval rollup records",
        fields: [
          {
            label: "Meetings",
            value: "No air safety meetings recorded",
          },
        ],
      });
      return sections;
    }

    statuses.forEach((status) => {
      const statusRecords = records.filter(
        (record) => record.latestSignoffApprovalStatus === status,
      );

      sections.push({
        heading: this.getApprovalRollupSectionHeading(status),
        fields: [
          {
            label: "Meetings",
            value:
              statusRecords.length > 0
                ? statusRecords
                    .map((record) => this.renderApprovalRollupRecord(record))
                    .join("; ")
                : `No ${status.replaceAll("_", " ")} meetings`,
          },
        ],
      });
    });

    return sections;
  }

  private buildApprovalRollupSummaryReportSections(
    summary: AirSafetyMeetingApprovalRollupSummary,
  ): AirSafetyMeetingReportSection[] {
    const sections: AirSafetyMeetingReportSection[] = [
      {
        heading: "Summary approval overview",
        fields: [
          { label: "Summary generated at", value: summary.generatedAt },
          {
            label: "Governance summary approval status",
            value: summary.governanceSignoffApproval.status,
          },
          { label: "Total meetings", value: summary.counts.total },
          { label: "Approved meetings", value: summary.counts.approved },
          { label: "Rejected meetings", value: summary.counts.rejected },
          {
            label: "Requires follow-up meetings",
            value: summary.counts.requiresFollowUp,
          },
          { label: "Unsigned meetings", value: summary.counts.unsigned },
        ],
      },
      this.buildSummaryApprovalSignoffSection(summary),
    ];

    const groupedSections: Array<{
      heading: string;
      records: AirSafetyMeetingApprovalRollupRecord[];
      emptyLabel: string;
    }> = [
      {
        heading: "Approved meetings",
        records: summary.approvedMeetings,
        emptyLabel: "No approved meetings",
      },
      {
        heading: "Rejected meetings",
        records: summary.rejectedMeetings,
        emptyLabel: "No rejected meetings",
      },
      {
        heading: "Requires follow-up meetings",
        records: summary.requiresFollowUpMeetings,
        emptyLabel: "No requires follow-up meetings",
      },
      {
        heading: "Unsigned meetings",
        records: summary.unsignedMeetings,
        emptyLabel: "No unsigned meetings",
      },
    ];

    groupedSections.forEach(({ heading, records, emptyLabel }) => {
      sections.push({
        heading,
        fields: [
          {
            label: "Meetings",
            value:
              records.length > 0
                ? records
                    .map((record) => this.renderApprovalRollupRecord(record))
                    .join("; ")
                : emptyLabel,
          },
        ],
      });
    });

    return sections;
  }

  private buildSummaryApprovalSignoffSection(
    summary: AirSafetyMeetingApprovalRollupSummary,
  ): AirSafetyMeetingReportSection {
    const pendingSignoff = "Pending sign-off";
    const signoff = summary.governanceSignoffApproval.latestSignoff;

    return {
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
          label: "Review notes/comments",
          value: signoff?.reviewNotes ?? pendingSignoff,
        },
      ],
    };
  }

  private getApprovalRollupSectionHeading(
    status: AirSafetyMeetingApprovalRollupRecord["latestSignoffApprovalStatus"],
  ): string {
    if (status === "requires_follow_up") {
      return "Requires follow-up meetings";
    }

    if (status === "unsigned") {
      return "Unsigned meetings";
    }

    return `${status.charAt(0).toUpperCase()}${status.slice(1)} meetings`;
  }

  private renderApprovalRollupRecord(
    record: AirSafetyMeetingApprovalRollupRecord,
  ): string {
    return [
      record.meetingId,
      record.meetingType,
      record.meetingStatus,
      record.dueAt,
      record.heldAt ?? "held at not recorded",
      record.chairperson ?? "chairperson not recorded",
      record.latestSignoffApprovalStatus,
      record.accountableManagerName ?? "accountable manager not recorded",
      record.signedAt ?? "signed at not recorded",
      record.reviewNotes ?? "no review notes",
    ].join(" | ");
  }

  private buildMeetingPackReportSections(
    meetingExport: AirSafetyMeetingPackExport,
    signoff: AirSafetyMeetingSignoff | null,
  ): AirSafetyMeetingReportSection[] {
    const meeting = meetingExport.meeting;
    const pendingSignoff = "Pending sign-off";
    const sections: AirSafetyMeetingReportSection[] = [
      {
        heading: "Meeting summary",
        fields: [
          { label: "Meeting ID", value: meeting.id },
          { label: "Meeting type", value: meeting.meetingType },
          { label: "Status", value: meeting.status },
          { label: "Due at", value: meeting.dueAt },
          { label: "Held at", value: meeting.heldAt },
          { label: "Chairperson", value: meeting.chairperson },
          {
            label: "Attendees",
            value:
              meeting.attendees.length > 0
                ? meeting.attendees.join(", ")
                : "No attendees recorded",
          },
          { label: "Created by", value: meeting.createdBy },
          { label: "Created at", value: meeting.createdAt },
          { label: "Closed at", value: meeting.closedAt },
          { label: "Export generated at", value: meetingExport.generatedAt },
        ],
      },
      {
        heading: "Meeting metadata",
        fields: [
          {
            label: "Scheduled period start",
            value: meeting.scheduledPeriodStart,
          },
          {
            label: "Scheduled period end",
            value: meeting.scheduledPeriodEnd,
          },
          {
            label: "Standing agenda",
            value:
              meeting.agenda.length > 0
                ? meeting.agenda.join("; ")
                : "No standing agenda recorded",
          },
          { label: "Minutes", value: meeting.minutes },
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
            label: "Review notes/comments",
            value: signoff?.reviewNotes ?? pendingSignoff,
          },
        ],
      },
    ];

    if (meetingExport.agendaItems.length === 0) {
      sections.push({
        heading: "Agenda-linked safety events",
        fields: [
          {
            label: "Agenda items",
            value: "No agenda-linked safety events recorded",
          },
          {
            label: "Action proposals",
            value: "No safety action proposals recorded",
          },
          {
            label: "Implementation closure evidence",
            value: "No implementation closure evidence recorded",
          },
        ],
      });
      return sections;
    }

    meetingExport.agendaItems.forEach((item, index) => {
      sections.push(this.buildAgendaItemSection(item, index));

      if (item.actionProposals.length === 0) {
        sections.push({
          heading: `Agenda item ${index + 1} actions`,
          fields: [
            {
              label: "Action proposals",
              value: "No safety action proposals recorded",
            },
            {
              label: "Decision history",
              value: "No action decisions recorded",
            },
            {
              label: "Implementation closure evidence",
              value: "No implementation closure evidence recorded",
            },
          ],
        });
        return;
      }

      item.actionProposals.forEach((proposal, proposalIndex) => {
        sections.push(
          this.buildActionProposalSection(index, proposalIndex, proposal),
        );
      });
    });

    return sections;
  }

  private buildAgendaItemSection(
    item: AirSafetyMeetingPackExportAgendaItem,
    index: number,
  ): AirSafetyMeetingReportSection {
    return {
      heading: `Agenda item ${index + 1}`,
      fields: [
        { label: "Agenda link ID", value: item.link.id },
        { label: "Agenda item", value: item.link.agendaItem },
        { label: "Linked by", value: item.link.linkedBy },
        { label: "Linked at", value: item.link.linkedAt },
        { label: "Safety event ID", value: item.safetyEvent.id },
        { label: "Safety event type", value: item.safetyEvent.eventType },
        { label: "Severity", value: item.safetyEvent.severity },
        { label: "Event status", value: item.safetyEvent.status },
        { label: "Event summary", value: item.safetyEvent.summary },
        { label: "SOP reference", value: item.safetyEvent.sopReference },
        { label: "Meeting required", value: item.meetingTrigger.meetingRequired },
        {
          label: "Recommended meeting type",
          value: item.meetingTrigger.recommendedMeetingType,
        },
        {
          label: "Trigger reasons",
          value:
            item.meetingTrigger.triggerReasons.length > 0
              ? item.meetingTrigger.triggerReasons.join(", ")
              : "No trigger reasons recorded",
        },
        {
          label: "Review flags",
          value: this.renderReviewFlags(item.meetingTrigger.reviewFlags),
        },
        { label: "Assessed by", value: item.meetingTrigger.assessedBy },
        { label: "Assessed at", value: item.meetingTrigger.assessedAt },
      ],
    };
  }

  private buildActionProposalSection(
    agendaIndex: number,
    proposalIndex: number,
    proposal: AirSafetyMeetingPackExportActionProposal,
  ): AirSafetyMeetingReportSection {
    const prefix = `Agenda item ${agendaIndex + 1} action ${proposalIndex + 1}`;

    return {
      heading: prefix,
      fields: [
        { label: "Action proposal ID", value: proposal.id },
        { label: "Proposal type", value: proposal.proposalType },
        { label: "Proposal status", value: proposal.status },
        { label: "Proposal summary", value: proposal.summary },
        { label: "Rationale", value: proposal.rationale },
        { label: "Proposed owner", value: proposal.proposedOwner },
        { label: "Proposed due at", value: proposal.proposedDueAt },
        { label: "Created by", value: proposal.createdBy },
        {
          label: "Decision history",
          value:
            proposal.decisions.length > 0
              ? proposal.decisions
                  .map((decision) =>
                    [
                      decision.decision,
                      decision.decidedBy ?? "actor not recorded",
                      decision.decidedAt,
                      decision.decisionNotes ?? "no notes",
                    ].join(" | "),
                  )
                  .join("; ")
              : "No action decisions recorded",
        },
        {
          label: "Implementation closure evidence",
          value:
            proposal.implementationEvidence.length > 0
              ? proposal.implementationEvidence
                  .map((evidence) =>
                    [
                      evidence.evidenceCategory,
                      evidence.implementationSummary,
                      evidence.evidenceReference ?? "no reference",
                      evidence.completedBy ?? "completed by not recorded",
                      evidence.completedAt,
                      evidence.reviewedBy ?? "reviewer not recorded",
                      evidence.reviewNotes ?? "no review notes",
                    ].join(" | "),
                  )
                  .join("; ")
              : "No implementation closure evidence recorded",
        },
      ],
    };
  }

  private renderReviewFlags(flags: Record<string, boolean>): string {
    const enabledFlags = Object.entries(flags)
      .filter(([, enabled]) => enabled)
      .map(([flag]) => flag);

    return enabledFlags.length > 0
      ? enabledFlags.join(", ")
      : "No review flags recorded";
  }

  private renderSectionsAsPlainText(
    sections: AirSafetyMeetingReportSection[],
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

  private buildSimplePdf(lines: string[]): Buffer {
    const flattenedLines = lines.flatMap((line) => this.wrapPdfText(line, 92));
    const contentLines = flattenedLines
      .map((line, index) => {
        const y = 780 - index * 14;
        return `BT /F1 10 Tf 40 ${y} Td (${this.escapePdfText(line)}) Tj ET`;
      })
      .join("\n");

    const contentStream = `${contentLines}\n`;
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${Buffer.byteLength(contentStream, "latin1")} >>\nstream\n${contentStream}endstream`,
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

  private async getLatestAirSafetyMeetingSignoff(
    meetingId: string,
  ): Promise<AirSafetyMeetingSignoff | null> {
    const client = await this.pool.connect();

    try {
      return await this.airSafetyMeetingRepository.getLatestAirSafetyMeetingSignoff(
        client,
        meetingId,
      );
    } finally {
      client.release();
    }
  }

}
