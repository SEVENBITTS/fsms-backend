import type { Pool } from "pg";
import { AirSafetyMeetingRepository } from "./air-safety-meeting.repository";
import type {
  AirSafetyMeeting,
  CreateAirSafetyMeetingInput,
  QuarterlyAirSafetyMeetingCompliance,
  QuarterlyComplianceStatus,
} from "./air-safety-meeting.types";
import {
  validateCreateAirSafetyMeetingInput,
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
}
