import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import type {
  Alert,
  AlertRow,
  AlertStatus,
  AlertType,
  CreateAlertInput,
  ListAlertsQuery,
} from "./alert.types";

type DbTx = PoolClient;

const toAlert = (row: AlertRow): Alert => ({
  id: row.id,
  missionId: row.mission_id,
  alertType: row.alert_type,
  severity: row.severity,
  status: row.status,
  message: row.message,
  metadata: row.metadata,
  source: row.source,
  triggeredAt: row.triggered_at.toISOString(),
  createdAt: row.created_at.toISOString(),
  acknowledgedAt: row.acknowledged_at
    ? row.acknowledged_at.toISOString()
    : null,
  resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
});

export class AlertRepository {
  async missionExists(tx: DbTx, missionId: string): Promise<boolean> {
    const result = await tx.query(
      `
      select 1
      from missions
      where id = $1
      limit 1
      `,
      [missionId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async insert(
    tx: DbTx,
    input: CreateAlertInput,
  ): Promise<Alert> {
    const result = await tx.query<AlertRow>(
      `
      insert into alerts (
        id,
        mission_id,
        alert_type,
        severity,
        status,
        message,
        metadata,
        source,
        triggered_at
      )
      values ($1, $2, $3, $4, 'open', $5, $6::jsonb, $7, $8)
      returning
        id,
        mission_id,
        alert_type,
        severity,
        status,
        message,
        metadata,
        source,
        triggered_at,
        created_at,
        acknowledged_at,
        resolved_at
      `,
      [
        randomUUID(),
        input.missionId,
        input.alertType,
        input.severity,
        input.message,
        JSON.stringify(input.metadata ?? {}),
        input.source ?? "telemetry",
        input.triggeredAt,
      ],
    );

    if (result.rowCount !== 1) {
      throw new Error(`Failed to insert alert for mission ${input.missionId}`);
    }

    return toAlert(result.rows[0]);
  }

  async getById(
    tx: DbTx,
    alertId: string,
  ): Promise<Alert | null> {
    const result = await tx.query<AlertRow>(
      `
      select
        id,
        mission_id,
        alert_type,
        severity,
        status,
        message,
        metadata,
        source,
        triggered_at,
        created_at,
        acknowledged_at,
        resolved_at
      from alerts
      where id = $1
      `,
      [alertId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return toAlert(result.rows[0]);
  }

  async list(
    tx: DbTx,
    query: ListAlertsQuery = {},
  ): Promise<Alert[]> {
    const where: string[] = [];
    const values: unknown[] = [];

    const push = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };

    if (query.missionId) {
      where.push(`mission_id = ${push(query.missionId)}`);
    }

    if (query.status) {
      where.push(`status = ${push(query.status)}`);
    }

    if (query.alertType) {
      where.push(`alert_type = ${push(query.alertType)}`);
    }

    const limitPlaceholder = push(query.limit ?? 100);

    const sql = `
      select
        id,
        mission_id,
        alert_type,
        severity,
        status,
        message,
        metadata,
        source,
        triggered_at,
        created_at,
        acknowledged_at,
        resolved_at
      from alerts
      ${where.length > 0 ? `where ${where.join(" and ")}` : ""}
      order by triggered_at desc, created_at desc, id desc
      limit ${limitPlaceholder}
    `;

    const result = await tx.query<AlertRow>(sql, values);

    return result.rows.map(toAlert);
  }

  async acknowledge(
    tx: DbTx,
    alertId: string,
    acknowledgedAt: string = new Date().toISOString(),
  ): Promise<Alert | null> {
    const result = await tx.query<AlertRow>(
      `
      update alerts
      set
        status = 'acknowledged',
        acknowledged_at = $2
      where id = $1
        and status = 'open'
      returning
        id,
        mission_id,
        alert_type,
        severity,
        status,
        message,
        metadata,
        source,
        triggered_at,
        created_at,
        acknowledged_at,
        resolved_at
      `,
      [alertId, acknowledgedAt],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return toAlert(result.rows[0]);
  }

  async resolve(
    tx: DbTx,
    alertId: string,
    resolvedAt: string = new Date().toISOString(),
  ): Promise<Alert | null> {
    const result = await tx.query<AlertRow>(
      `
      update alerts
      set
        status = 'resolved',
        resolved_at = $2
      where id = $1
        and status <> 'resolved'
      returning
        id,
        mission_id,
        alert_type,
        severity,
        status,
        message,
        metadata,
        source,
        triggered_at,
        created_at,
        acknowledged_at,
        resolved_at
      `,
      [alertId, resolvedAt],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return toAlert(result.rows[0]);
  }

  async listOpenByMissionAndType(
    tx: DbTx,
    missionId: string,
    alertType: AlertType,
  ): Promise<Alert[]> {
    const result = await tx.query<AlertRow>(
      `
      select
        id,
        mission_id,
        alert_type,
        severity,
        status,
        message,
        metadata,
        source,
        triggered_at,
        created_at,
        acknowledged_at,
        resolved_at
      from alerts
      where mission_id = $1
        and alert_type = $2
        and status = 'open'
      order by triggered_at desc, created_at desc, id desc
      `,
      [missionId, alertType],
    );

    return result.rows.map(toAlert);
  }

  async resolveOpenByMissionAndType(
    tx: DbTx,
    missionId: string,
    alertType: AlertType,
    resolvedAt: string = new Date().toISOString(),
  ): Promise<number> {
    const result = await tx.query(
      `
      update alerts
      set
        status = 'resolved',
        resolved_at = $3
      where mission_id = $1
        and alert_type = $2
        and status in ('open', 'acknowledged')
      `,
      [missionId, alertType, resolvedAt],
    );

    return result.rowCount ?? 0;
  }
}
