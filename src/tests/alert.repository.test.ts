import { randomUUID } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";
import { AlertRepository } from "../alerts/alert.repository";
import type { AlertType } from "../alerts/alert.types";

const repository = new AlertRepository();

const insertMission = async (id: string, status: string = "active") => {
  await pool.query(
    `
    insert into missions (
      id,
      status,
      mission_plan_id,
      last_event_sequence_no
    )
    values ($1, $2, $3, $4)
    `,
    [id, status, "plan-1", 0],
  );
};

describe("AlertRepository", () => {
  beforeAll(async () => {
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await pool.query("delete from alerts");
    await pool.query("delete from mission_telemetry");
    await pool.query("delete from mission_events");
    await pool.query("delete from missions");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("inserts an alert", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    const client = await pool.connect();
    try {
      await client.query("begin");

      const alert = await repository.insert(client, {
        missionId,
        alertType: "ALTITUDE_HIGH",
        severity: "warning",
        message: "Altitude exceeded threshold",
        triggeredAt: "2026-04-15T10:00:00Z",
        metadata: {
          threshold: 120,
          actual: 145,
        },
      });

      await client.query("commit");

      expect(alert.missionId).toBe(missionId);
      expect(alert.alertType).toBe("ALTITUDE_HIGH");
      expect(alert.severity).toBe("warning");
      expect(alert.status).toBe("open");
      expect(alert.message).toBe("Altitude exceeded threshold");
      expect(alert.metadata).toMatchObject({
        threshold: 120,
        actual: 145,
      });
      expect(alert.triggeredAt).toBe("2026-04-15T10:00:00.000Z");
    } finally {
      client.release();
    }
  });

  it("gets an alert by id", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    const client = await pool.connect();
    let insertedId: string;
    try {
      await client.query("begin");

      const inserted = await repository.insert(client, {
        missionId,
        alertType: "SPEED_HIGH",
        severity: "critical",
        message: "Speed exceeded threshold",
        triggeredAt: "2026-04-15T10:05:00Z",
      });

      insertedId = inserted.id;

      await client.query("commit");
    } finally {
      client.release();
    }

    const readClient = await pool.connect();
    try {
      const found = await repository.getById(readClient, insertedId);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(insertedId);
      expect(found?.alertType).toBe("SPEED_HIGH");
      expect(found?.severity).toBe("critical");
    } finally {
      readClient.release();
    }
  });

  it("returns null from getById when alert does not exist", async () => {
    const client = await pool.connect();
    try {
      const found = await repository.getById(client, randomUUID());
      expect(found).toBeNull();
    } finally {
      client.release();
    }
  });

  it("lists alerts filtered by mission", async () => {
    const missionId = randomUUID();
    const otherMissionId = randomUUID();

    await insertMission(missionId);
    await insertMission(otherMissionId);

    const client = await pool.connect();
    try {
      await client.query("begin");

      await repository.insert(client, {
        missionId,
        alertType: "ALTITUDE_HIGH",
        severity: "warning",
        message: "Altitude high",
        triggeredAt: "2026-04-15T10:00:00Z",
      });

      await repository.insert(client, {
        missionId,
        alertType: "SPEED_HIGH",
        severity: "critical",
        message: "Speed high",
        triggeredAt: "2026-04-15T10:10:00Z",
      });

      await repository.insert(client, {
        missionId: otherMissionId,
        alertType: "RESTRICTED_ZONE",
        severity: "critical",
        message: "Restricted zone entered",
        triggeredAt: "2026-04-15T10:20:00Z",
      });

      await client.query("commit");
    } finally {
      client.release();
    }

    const readClient = await pool.connect();
    try {
      const alerts = await repository.list(readClient, { missionId });

      expect(alerts).toHaveLength(2);
      expect(alerts.map((item) => item.alertType)).toEqual([
        "SPEED_HIGH",
        "ALTITUDE_HIGH",
      ]);
      expect(alerts.every((item) => item.missionId === missionId)).toBe(true);
    } finally {
      readClient.release();
    }
  });

  it("lists alerts filtered by status and type", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    const client = await pool.connect();
    let alertId: string;
    try {
      await client.query("begin");

      const openAlert = await repository.insert(client, {
        missionId,
        alertType: "ALTITUDE_HIGH",
        severity: "warning",
        message: "Altitude high",
        triggeredAt: "2026-04-15T10:00:00Z",
      });

      alertId = openAlert.id;

      await repository.insert(client, {
        missionId,
        alertType: "SPEED_HIGH",
        severity: "critical",
        message: "Speed high",
        triggeredAt: "2026-04-15T10:01:00Z",
      });

      await client.query("commit");
    } finally {
      client.release();
    }

    const ackClient = await pool.connect();
    try {
      await repository.acknowledge(ackClient, alertId, "2026-04-15T10:02:00Z");
    } finally {
      ackClient.release();
    }

    const readClient = await pool.connect();
    try {
      const alerts = await repository.list(readClient, {
        missionId,
        status: "acknowledged",
        alertType: "ALTITUDE_HIGH",
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].status).toBe("acknowledged");
      expect(alerts[0].alertType).toBe("ALTITUDE_HIGH");
    } finally {
      readClient.release();
    }
  });

  it("acknowledges an open alert", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    let alertId: string;

    const client = await pool.connect();
    try {
      await client.query("begin");

      const inserted = await repository.insert(client, {
        missionId,
        alertType: "MISSION_INACTIVE_TELEMETRY",
        severity: "warning",
        message: "Telemetry received while mission inactive",
        triggeredAt: "2026-04-15T10:00:00Z",
      });

      alertId = inserted.id;

      await client.query("commit");
    } finally {
      client.release();
    }

    const ackClient = await pool.connect();
    try {
      const acknowledged = await repository.acknowledge(
        ackClient,
        alertId,
        "2026-04-15T10:03:00Z",
      );

      expect(acknowledged).not.toBeNull();
      expect(acknowledged?.status).toBe("acknowledged");
      expect(acknowledged?.acknowledgedAt).toBe("2026-04-15T10:03:00.000Z");
    } finally {
      ackClient.release();
    }
  });

  it("returns null when acknowledging a non-open alert", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    let alertId: string;

    const client = await pool.connect();
    try {
      await client.query("begin");

      const inserted = await repository.insert(client, {
        missionId,
        alertType: "ALTITUDE_HIGH",
        severity: "warning",
        message: "Altitude high",
        triggeredAt: "2026-04-15T10:00:00Z",
      });

      alertId = inserted.id;

      await client.query("commit");
    } finally {
      client.release();
    }

    const ackClient = await pool.connect();
    try {
      await repository.acknowledge(ackClient, alertId, "2026-04-15T10:01:00Z");
    } finally {
      ackClient.release();
    }

    const secondAckClient = await pool.connect();
    try {
      const second = await repository.acknowledge(
        secondAckClient,
        alertId,
        "2026-04-15T10:02:00Z",
      );

      expect(second).toBeNull();
    } finally {
      secondAckClient.release();
    }
  });

  it("resolves an alert", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    let alertId: string;

    const client = await pool.connect();
    try {
      await client.query("begin");

      const inserted = await repository.insert(client, {
        missionId,
        alertType: "RESTRICTED_ZONE",
        severity: "critical",
        message: "Restricted zone entered",
        triggeredAt: "2026-04-15T10:00:00Z",
      });

      alertId = inserted.id;

      await client.query("commit");
    } finally {
      client.release();
    }

    const resolveClient = await pool.connect();
    try {
      const resolved = await repository.resolve(
        resolveClient,
        alertId,
        "2026-04-15T10:04:00Z",
      );

      expect(resolved).not.toBeNull();
      expect(resolved?.status).toBe("resolved");
      expect(resolved?.resolvedAt).toBe("2026-04-15T10:04:00.000Z");
    } finally {
      resolveClient.release();
    }
  });

  it("lists open alerts by mission and type", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    const client = await pool.connect();
    let toAcknowledgeId: string;
    try {
      await client.query("begin");

      const first = await repository.insert(client, {
        missionId,
        alertType: "ALTITUDE_HIGH",
        severity: "warning",
        message: "Altitude high 1",
        triggeredAt: "2026-04-15T10:00:00Z",
      });

      await repository.insert(client, {
        missionId,
        alertType: "ALTITUDE_HIGH",
        severity: "warning",
        message: "Altitude high 2",
        triggeredAt: "2026-04-15T10:01:00Z",
      });

      await repository.insert(client, {
        missionId,
        alertType: "SPEED_HIGH",
        severity: "critical",
        message: "Speed high",
        triggeredAt: "2026-04-15T10:02:00Z",
      });

      toAcknowledgeId = first.id;

      await client.query("commit");
    } finally {
      client.release();
    }

    const ackClient = await pool.connect();
    try {
      await repository.acknowledge(
        ackClient,
        toAcknowledgeId,
        "2026-04-15T10:03:00Z",
      );
    } finally {
      ackClient.release();
    }

    const readClient = await pool.connect();
    try {
      const alerts = await repository.listOpenByMissionAndType(
        readClient,
        missionId,
        "ALTITUDE_HIGH",
      );

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe("ALTITUDE_HIGH");
      expect(alerts[0].status).toBe("open");
      expect(alerts[0].message).toBe("Altitude high 2");
    } finally {
      readClient.release();
    }
  });

  it("resolves open and acknowledged alerts by mission and type", async () => {
    const missionId = randomUUID();
    await insertMission(missionId);

    let openId: string;
    let acknowledgedId: string;
    let otherTypeId: string;

    const client = await pool.connect();
    try {
      await client.query("begin");

      const open = await repository.insert(client, {
        missionId,
        alertType: "ALTITUDE_HIGH",
        severity: "warning",
        message: "Altitude high open",
        triggeredAt: "2026-04-15T10:00:00Z",
      });

      const acknowledged = await repository.insert(client, {
        missionId,
        alertType: "ALTITUDE_HIGH",
        severity: "warning",
        message: "Altitude high acknowledged",
        triggeredAt: "2026-04-15T10:01:00Z",
      });

      const otherType = await repository.insert(client, {
        missionId,
        alertType: "SPEED_HIGH",
        severity: "critical",
        message: "Speed high",
        triggeredAt: "2026-04-15T10:02:00Z",
      });

      openId = open.id;
      acknowledgedId = acknowledged.id;
      otherTypeId = otherType.id;

      await client.query("commit");
    } finally {
      client.release();
    }

    const ackClient = await pool.connect();
    try {
      await repository.acknowledge(
        ackClient,
        acknowledgedId,
        "2026-04-15T10:03:00Z",
      );
    } finally {
      ackClient.release();
    }

    const resolveClient = await pool.connect();
    try {
      const count = await repository.resolveOpenByMissionAndType(
        resolveClient,
        missionId,
        "ALTITUDE_HIGH",
        "2026-04-15T10:04:00Z",
      );

      expect(count).toBe(2);
    } finally {
      resolveClient.release();
    }

    const readClient = await pool.connect();
    try {
      const open = await repository.getById(readClient, openId);
      const acknowledged = await repository.getById(readClient, acknowledgedId);
      const otherType = await repository.getById(readClient, otherTypeId);

      expect(open?.status).toBe("resolved");
      expect(acknowledged?.status).toBe("resolved");
      expect(otherType?.status).toBe("open");
    } finally {
      readClient.release();
    }
  });
});