import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import app from "../src/app";


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
  await reseedTimelineTable();
});

afterAll(async () => {
  await pool.end();
});

describe("timeline endpoint", () => {
  it("GET / returns the backend health text", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toBe("FSMS backend is running");
  });

  it("GET /timeline returns all items in ascending sequence order", async () => {
    const response = await request(app).get("/timeline");

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(9);
    expect(response.body.items.map((item: any) => item.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(response.body.pageInfo).toEqual({
      limit: 50,
      nextCursor: null,
      hasMore: false,
    });
  });

  it("normalizes id and sequence as numbers", async () => {
    const response = await request(app).get("/timeline");

    expect(response.status).toBe(200);

    for (const item of response.body.items) {
      expect(typeof item.id).toBe("number");
      expect(typeof item.sequence).toBe("number");
    }
  });

  it("filters by missionId", async () => {
    const response = await request(app).get("/timeline").query({ missionId: 10 });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(3);
    expect(response.body.items.map((item: any) => item.sequence)).toEqual([1, 2, 3]);
  });

  it("filters by aircraftId", async () => {
    const response = await request(app).get("/timeline").query({ aircraftId: 101 });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items.map((item: any) => item.sequence)).toEqual([4, 5]);
  });

  it("filters by classified=true", async () => {
    const response = await request(app).get("/timeline").query({ classified: true });

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: any) => item.sequence)).toEqual([1, 2, 3, 6, 7, 8, 9]);
  });

  it("filters by legacy=true", async () => {
    const response = await request(app).get("/timeline").query({ legacy: true });

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: any) => item.sequence)).toEqual([4, 5]);
  });

  it("filters by multiple event types", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({ eventType: "takeoff,landing" });

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: any) => item.sequence)).toEqual([2, 3, 7, 9]);
  });

  it("composes filters with AND semantics", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({
        missionId: 12,
        classified: true,
        eventType: "takeoff,landing",
      });

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: any) => item.sequence)).toEqual([7, 9]);
  });

  it("filters by date range", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({
        startAt: "2026-04-01T00:00:00.000Z",
        endAt: "2026-04-02T00:00:00.000Z",
      });

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: any) => item.sequence)).toEqual([1, 2, 3]);
  });

  it("supports cursor pagination with afterSequence and limit", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({
        afterSequence: 2,
        limit: 2,
      });

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: any) => item.sequence)).toEqual([3, 4]);
    expect(response.body.pageInfo).toEqual({
      limit: 2,
      nextCursor: 4,
      hasMore: true,
    });
  });

  it("returns empty items with valid pageInfo when no rows match", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({
        missionId: 999999,
      });

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.pageInfo).toEqual({
      limit: 50,
      nextCursor: null,
      hasMore: false,
    });
  });

  it("returns a structured JSON error for invalid sequence windows", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({
        afterSequence: 10,
        beforeSequence: 5,
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        message: "afterSequence must be less than beforeSequence",
        type: "http_error",
      },
    });
  });

  it("returns a structured JSON error for invalid date windows", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({
        startAt: "2026-04-02T10:00:00.000Z",
        endAt: "2026-04-02T09:00:00.000Z",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        message: "startAt must be before endAt",
        type: "http_error",
      },
    });
  });

  it("returns a structured JSON error for invalid boolean values", async () => {
    const response = await request(app)
      .get("/timeline")
      .query({
        classified: "maybe",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.type).toBe("http_error");
    expect(typeof response.body.error.message).toBe("string");
  });
});