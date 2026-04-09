import path from "path";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { Pool } from "pg";

import { Db, MissionService } from "./missions/mission.service";
import { MissionRepository } from "./missions/mission.repository";
import { MissionEventRepository } from "./missions/mission-event.repository";
import { MissionController } from "./missions/mission.controller";
import { createMissionRouter } from "./missions/mission.routes";

import { createTimelineRouter } from "./routes/timeline";
import { TimelineService } from "./services/timeline.service";
import { HttpError } from "./utils/errors";
import { runMigrations } from "./migrations/runMigrations";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  quiet: true,
});

if (process.env.NODE_ENV !== "test") {
  console.log("PG env check", {
    envPath: path.resolve(process.cwd(), ".env"),
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    passwordType: typeof process.env.PGPASSWORD,
    hasPassword: !!process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  });
}

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

if (process.env.NODE_ENV !== "test") {
  pool.connect()
    .then(async (client) => {
      client.release();
      await runMigrations(pool);
    })
    .catch((error) => {
      console.error("Failed to initialize database:", error);
    });
}

const db = new Db(pool);
const missionRepo = new MissionRepository();
const missionEventRepo = new MissionEventRepository();
const missionService = new MissionService(db, missionRepo, missionEventRepo);
const missionController = new MissionController(missionService);

const timelineService = new TimelineService(pool);

app.use("/missions", createMissionRouter(missionController));
app.use("/timeline", createTimelineRouter(timelineService));


app.get("/", (_req, res) => {
  res.status(200).send("FSMS backend is running");
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: {
        message: error.message,
        type: error.type
      }
    });
  }

  console.error("Unhandled error:", error);

  return res.status(500).json({
    error: {
      message: error instanceof Error ? error.message : "Unknown error",
      type: "internal_error"
    }
  });
});

export default app;
export { pool };


   



