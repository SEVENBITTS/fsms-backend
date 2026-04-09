import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import app from "../app";
import { runMigrations } from "../migrations/runMigrations";

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

async function reseedTimelineTable(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE timeline_events RESTART IDENTITY;

    INSERT INTO timeline_events
    (sequence, mission_id, aircraft_id, event_type, event_time, classified, legacy, payload)
    VALUES
    (1, 10, 100, 'mission.created',  '2026-04-01T08:00:00Z', true,  false, '{"source":"new"}'),
    (2, 10, 100, 'takeoff',          '2026-04-01T08:15:00Z', true,  false, '{"runway":"09"}'),
    (3, 10, 100, 'landing',          '2026-04-01T09:00:00Z', true,  false, '{"runway":"27"}'),
    (4, 11, 101, 'mission.created',  '2026-04-02T10:00:00Z', false, true,  '{"source":"legacy"}'),
    (5, 11, 101, 'position.recorded','2026-04-02T10:05:00Z', false, true,  '{"lat":1,"lon":2}'),
    (6, 12, 102, 'mission.created',  '2026-04-03T11:00:00Z', true,  false, '{"source":"new"}'),
    (7, 12, 102, 'takeoff',          '2026-04-03T11:10:00Z', true,  false, '{"runway":"18"}'),
    (8, 12, 102, 'position.recorded','2026-04-03T11:20:00Z', true,  false, '{"lat":3,"lon":4}'),
    (9, 12, 102, 'landing',          '2026-04-03T12:00:00Z', true,  false, '{"runway":"36"}');
  `);
}

beforeAll(async () => {
  await runMigrations(pool);
});

beforeEach(async () => {
  await reseedTimelineTable();
});

afterAll(async () => {
  await pool.end();
});

describe("timeline endpoint (read)", () => {
  it("GET / returns the backend health text", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toBe("FSMS backend is running");
  });

  it("GET /timeline returns all items in ascending sequence order", async () => {
    const response = await request(app).get("/timeline");

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(9);
    expect(response.body.items.map((i: any) => i.sequence)).toEqual([1,2,3,4,5,6,7,8,9]);
  });

  it("filters by missionId", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({ missionId: 10 });

    expect(response.status).toBe(200);
    expect(response.body.items.map((i: any) => i.sequence)).toEqual([1,2,3]);
  });

  it("filters by aircraftId", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({ aircraftId: 101 });

    expect(response.status).toBe(200);
    expect(response.body.items.map((i: any) => i.sequence)).toEqual([4,5]);
  });

  it("filters by classified=true", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({ classified: true });

    expect(response.status).toBe(200);
    expect(response.body.items.map((i: any) => i.sequence)).toEqual([1,2,3,6,7,8,9]);
  });

  it("filters by legacy=true", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({ legacy: true });

    expect(response.status).toBe(200);
    expect(response.body.items.map((i: any) => i.sequence)).toEqual([4,5]);
  });

  it("filters by date range", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({
        startAt: "2026-04-01T00:00:00Z",
        endAt: "2026-04-02T00:00:00Z",
      });

    expect(response.status).toBe(200);
    expect(response.body.items.map((i: any) => i.sequence)).toEqual([1,2,3]);
  });

  it("supports pagination (afterSequence)", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({ afterSequence: 5 });

    expect(response.status).toBe(200);
    expect(response.body.items.map((i: any) => i.sequence)).toEqual([6,7,8,9]);
  });

  it("returns empty result when no match", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({ missionId: 999 });

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  it("rejects invalid sequence window", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({ afterSequence: 10, beforeSequence: 5 });

    expect(response.status).toBe(400);
  });

  it("rejects invalid date window", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({
        startAt: "2026-04-02T10:00:00Z",
        endAt: "2026-04-02T09:00:00Z",
      });

    expect(response.status).toBe(400);
  });
});