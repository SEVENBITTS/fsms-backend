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
import { MissionLifecyclePolicy } from "./missions/mission-lifecycle.policy";
import { MissionTelemetryRepository } from "./missions/mission-telemetry.repository";
import { MissionTelemetryService } from "./missions/mission-telemetry.service";
import { MissionTelemetryController } from "./missions/mission-telemetry.controller";
import { createMissionTelemetryRouter } from "./missions/mission-telemetry.routes";
import { normalizeError } from "./utils/error-response";
import { AlertRepository } from "./alerts/alert.repository";
import { AlertService } from "./alerts/alert.service";


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



const db = new Db(pool);
const missionRepo = new MissionRepository();
const missionEventRepo = new MissionEventRepository();
const missionService = new MissionService(db, missionRepo, missionEventRepo);
const missionController = new MissionController(missionService);

const missionLifecyclePolicy = new MissionLifecyclePolicy();
const missionTelemetryRepo = new MissionTelemetryRepository();
const alertRepository = new AlertRepository();
const alertService = new AlertService(pool, alertRepository);

const missionTelemetryService = new MissionTelemetryService(
  pool,
  missionRepo,
  missionTelemetryRepo,
  missionLifecyclePolicy,
  alertService,
);
const missionTelemetryController = new MissionTelemetryController(
  missionTelemetryService,
);

const timelineService = new TimelineService(pool);

app.use("/missions", createMissionRouter(missionController));
app.use("/missions", createMissionTelemetryRouter(missionTelemetryController));
app.use("/timeline", createTimelineRouter(timelineService));
app.get("/", (_req, res) => {
  res.status(200).send("FSMS backend is running");
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: {
        message: error.message,
        type: error.type,
      },
    });
  }

  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  ) {
    const appError = error as Error & {
      statusCode: number;
      code?: string;
      type?: string;
    };

    return res.status(appError.statusCode).json({
      error: {
        message: appError.message,
        type: appError.type ?? appError.code?.toLowerCase() ?? "application_error",
      },
    });
  }

  console.error("Unhandled error:", error);

  return res.status(500).json({
    error: {
      message: error instanceof Error ? error.message : "Unknown error",
      type: "internal_error",
    },
  });
});

export default app;
export { pool };


   



