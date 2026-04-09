import { MissionEventType } from "./mission-event-types";

type Severity = "info" | "warning" | "critical";

type EventRegistryEntry = {
  safetyRelevant: boolean;
  complianceRelevant: boolean;
  severity?: Severity;
};

export const missionEventRegistry: Record<MissionEventType, EventRegistryEntry> = {
  "mission.created": { safetyRelevant: false, complianceRelevant: true },
  "mission.submitted": { safetyRelevant: false, complianceRelevant: true },
  "mission.approved": { safetyRelevant: false, complianceRelevant: true },
  "mission.rejected": { safetyRelevant: false, complianceRelevant: true, severity: "warning" },
  "mission.cancelled": { safetyRelevant: false, complianceRelevant: true, severity: "warning" },

  "mission.launched": { safetyRelevant: true, complianceRelevant: true },
  "mission.completed": { safetyRelevant: true, complianceRelevant: true },
  "mission.aborted": { safetyRelevant: true, complianceRelevant: true, severity: "critical" },

  "risk_assessment.updated": { safetyRelevant: true, complianceRelevant: true },
  "airspace_check.completed": { safetyRelevant: true, complianceRelevant: true },
  "weather_check.completed": { safetyRelevant: true, complianceRelevant: true },

  "override.applied": { safetyRelevant: true, complianceRelevant: true, severity: "critical" },

  "telemetry.link_lost": { safetyRelevant: true, complianceRelevant: false, severity: "critical" },
  "telemetry.link_restored": { safetyRelevant: true, complianceRelevant: false, severity: "warning" },

  "geofence.breach.detected": { safetyRelevant: true, complianceRelevant: true, severity: "critical" },

  "incident.reported": { safetyRelevant: true, complianceRelevant: true, severity: "critical" },
};