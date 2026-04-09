import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app, { pool } from "../app";
import { runMigrations } from "../migrations/runMigrations";

describe("timeline integration", () => {
  beforeAll(async () => {
  await runMigrations(pool);
});

  afterAll(async () => {
    await pool.end();
  });

  it("POST /timeline inserts a valid row and returns normalized JSON", async () => {
    const response = await request(app)
      .post("/timeline")
      .send({
        missionId: 10,
        aircraftId: 101,
        eventType: "mission.approved",
        eventTime: "2026-04-02T12:00:00.000Z",
        classified: false,
        payload: {}
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      item: {
        id: expect.any(Number),
        sequence: expect.any(Number),
        missionId: 10,
        aircraftId: 101,
        eventType: "mission.approved",
        eventTime: "2026-04-02T12:00:00.000Z",
        classified: false,
        legacy: false,
        payload: {},
        createdAt: expect.any(String)
      }
    });
  });

  it("POST /timeline defaults classified=false and payload={}", async () => {
    const response = await request(app)
      .post("/timeline")
      .send({
        missionId: 10,
        eventType: "mission.reviewed",
        eventTime: "2026-04-02T13:00:00.000Z"
      });

    expect(response.status).toBe(201);
    expect(response.body.item.classified).toBe(false);
    expect(response.body.item.legacy).toBe(false);
    expect(response.body.item.payload).toEqual({});
  });

  it("POST /timeline supports mission-only events", async () => {
    const response = await request(app)
      .post("/timeline")
      .send({
        missionId: 10,
        eventType: "mission.only-event",
        eventTime: "2026-04-02T14:00:00.000Z",
        payload: {}
      });

    expect(response.status).toBe(201);
    expect(response.body.item.missionId).toBe(10);
    expect(response.body.item.aircraftId).toBeNull();
  });

  it("POST /timeline supports aircraft-only events", async () => {
    const response = await request(app)
      .post("/timeline")
      .send({
        aircraftId: 101,
        eventType: "aircraft.only-event",
        eventTime: "2026-04-02T15:00:00.000Z",
        payload: {}
      });

    expect(response.status).toBe(201);
    expect(response.body.item.aircraftId).toBe(101);
    expect(response.body.item.missionId).toBeNull();
  });

  it("POST /timeline supports classified=true", async () => {
    const response = await request(app)
      .post("/timeline")
      .send({
        missionId: 10,
        aircraftId: 101,
        eventType: "mission.classified-note",
        eventTime: "2026-04-02T16:00:00.000Z",
        classified: true,
        payload: { note: "secret" }
      });

    expect(response.status).toBe(201);
    expect(response.body.item.classified).toBe(true);
    expect(response.body.item.payload).toEqual({ note: "secret" });
  });

  it("POST /timeline rejects invalid datetime", async () => {
    const response = await request(app)
      .post("/timeline")
      .send({
        missionId: 10,
        eventType: "mission.bad-time",
        eventTime: "not-a-date"
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        message: expect.any(String),
        type: "http_error"
      }
    });
  });

  it("POST /timeline rejects forbidden fields", async () => {
    const response = await request(app)
      .post("/timeline")
      .send({
        missionId: 10,
        eventType: "mission.bad-field",
        eventTime: "2026-04-02T17:00:00.000Z",
        legacy: true
      });

    expect(response.status).toBe(400);
    expect(response.body.error.type).toBe("http_error");
  });

  it("POST /timeline assigns monotonic sequence server-side", async () => {
    const first = await request(app)
      .post("/timeline")
      .send({
        missionId: 10,
        eventType: "mission.seq-1",
        eventTime: "2026-04-02T18:00:00.000Z"
      });

    const second = await request(app)
      .post("/timeline")
      .send({
        missionId: 10,
        eventType: "mission.seq-2",
        eventTime: "2026-04-02T18:01:00.000Z"
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.item.sequence).toBeGreaterThan(first.body.item.sequence);
  });

  it("POST /timeline is visible through GET /timeline", async () => {
    const created = await request(app)
      .post("/timeline")
      .send({
        missionId: 10,
        aircraftId: 101,
        eventType: "mission.read-after-write",
        eventTime: "2026-04-02T19:00:00.000Z",
        payload: {}
      });

    expect(created.status).toBe(201);

    const response = await request(app)
      .get("/timeline")
      .query({ missionId: 10 });

    expect(response.status).toBe(200);

    const found = response.body.items.some(
      (item: { id: number }) => item.id === created.body.item.id
    );

    expect(found).toBe(true);
  });

  it("GET /timeline afterSequence returns new row and excludes prior cursor row", async () => {
    const first = await request(app)
      .post("/timeline")
      .send({
        missionId: 10,
        eventType: "mission.cursor-1",
        eventTime: "2026-04-02T20:00:00.000Z"
      });

    const second = await request(app)
      .post("/timeline")
      .send({
        missionId: 10,
        eventType: "mission.cursor-2",
        eventTime: "2026-04-02T20:01:00.000Z"
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const response = await request(app)
      .get("/timeline")
      .query({ afterSequence: first.body.item.sequence });

    expect(response.status).toBe(200);

    const includesSecond = response.body.items.some(
      (item: { sequence: number }) => item.sequence === second.body.item.sequence
    );

    const includesFirst = response.body.items.some(
      (item: { sequence: number }) => item.sequence === first.body.item.sequence
    );

    expect(includesSecond).toBe(true);
    expect(includesFirst).toBe(false);
  });
});