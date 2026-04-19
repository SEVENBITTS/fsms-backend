export type AirSafetyMeetingType =
  | "quarterly_air_safety_review"
  | "event_triggered_safety_review"
  | "sop_breach_review"
  | "training_review"
  | "maintenance_safety_review"
  | "accountable_manager_review";

export type AirSafetyMeetingStatus =
  | "scheduled"
  | "completed"
  | "cancelled";

export type QuarterlyComplianceStatus =
  | "compliant"
  | "due_soon"
  | "overdue";

export interface CreateAirSafetyMeetingInput {
  meetingType?: AirSafetyMeetingType;
  scheduledPeriodStart?: string | null;
  scheduledPeriodEnd?: string | null;
  dueAt?: string;
  heldAt?: string | null;
  status?: AirSafetyMeetingStatus;
  chairperson?: string | null;
  attendees?: string[];
  agenda?: string[];
  minutes?: string | null;
  createdBy?: string | null;
}

export interface AirSafetyMeeting {
  id: string;
  meetingType: AirSafetyMeetingType;
  scheduledPeriodStart: string | null;
  scheduledPeriodEnd: string | null;
  dueAt: string;
  heldAt: string | null;
  status: AirSafetyMeetingStatus;
  chairperson: string | null;
  attendees: string[];
  agenda: string[];
  minutes: string | null;
  createdBy: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface QuarterlyAirSafetyMeetingCompliance {
  status: QuarterlyComplianceStatus;
  requirement: "quarterly_air_safety_meeting";
  requirementMonths: 3;
  dueSoonWindowDays: 30;
  asOf: string;
  lastCompletedMeeting: AirSafetyMeeting | null;
  nextDueAt: string | null;
  message: string;
}
