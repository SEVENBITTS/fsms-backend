export type AlertType =
  | "ALTITUDE_HIGH"
  | "SPEED_HIGH"
  | "RESTRICTED_ZONE"
  | "MISSION_INACTIVE_TELEMETRY";

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertStatus = "open" | "acknowledged" | "resolved";

export type AlertSource = "telemetry";

export interface AlertRow {
  id: string;
  mission_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  metadata: Record<string, unknown>;
  source: AlertSource;
  triggered_at: Date;
  created_at: Date;
  acknowledged_at: Date | null;
  resolved_at: Date | null;
}

export interface Alert {
  id: string;
  missionId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  metadata: Record<string, unknown>;
  source: AlertSource;
  triggeredAt: string;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface CreateAlertInput {
  missionId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  triggeredAt: string;
  metadata?: Record<string, unknown>;
  source?: AlertSource;
}

export interface ListAlertsQuery {
  missionId?: string;
  status?: AlertStatus;
  alertType?: AlertType;
  limit?: number;
}

export interface AcknowledgeAlertInput {
  acknowledgedAt?: string;
}

export interface ResolveAlertInput {
  resolvedAt?: string;
}