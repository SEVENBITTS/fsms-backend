import fs from "fs";
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

import { AlertController } from "./alerts/alert.controller";
import { createAlertRouter } from "./alerts/alert.routes";
import { MissionReplayService } from "./replay/mission-replay.service";
import { MissionReplayController } from "./replay/mission-replay.controller";
import { createMissionReplayRouter } from "./replay/mission-replay.routes";
import { PlatformRepository } from "./platforms/platform.repository";
import { PlatformService } from "./platforms/platform.service";
import { PlatformController } from "./platforms/platform.controller";
import { createPlatformRouter } from "./platforms/platform.routes";
import { PilotRepository } from "./pilots/pilot.repository";
import { PilotService } from "./pilots/pilot.service";
import { PilotController } from "./pilots/pilot.controller";
import { createPilotRouter } from "./pilots/pilot.routes";
import { MissionRiskRepository } from "./mission-risk/mission-risk.repository";
import { MissionRiskService } from "./mission-risk/mission-risk.service";
import { MissionRiskController } from "./mission-risk/mission-risk.controller";
import { createMissionRiskRouter } from "./mission-risk/mission-risk.routes";
import { AirspaceComplianceRepository } from "./airspace-compliance/airspace-compliance.repository";
import { AirspaceComplianceService } from "./airspace-compliance/airspace-compliance.service";
import { AirspaceComplianceController } from "./airspace-compliance/airspace-compliance.controller";
import { createAirspaceComplianceRouter } from "./airspace-compliance/airspace-compliance.routes";
import { AuditEvidenceRepository } from "./audit-evidence/audit-evidence.repository";
import { AuditEvidenceService } from "./audit-evidence/audit-evidence.service";
import { AuditEvidenceController } from "./audit-evidence/audit-evidence.controller";
import { createAuditEvidenceRouter } from "./audit-evidence/audit-evidence.routes";
import { MissionPlanningRepository } from "./mission-planning/mission-planning.repository";
import { MissionPlanningService } from "./mission-planning/mission-planning.service";
import { MissionPlanningController } from "./mission-planning/mission-planning.controller";
import { createMissionPlanningRouter } from "./mission-planning/mission-planning.routes";
import { SmsFrameworkRepository } from "./sms-framework/sms-framework.repository";
import { SmsFrameworkService } from "./sms-framework/sms-framework.service";
import { SmsFrameworkController } from "./sms-framework/sms-framework.controller";
import { createSmsFrameworkRouter } from "./sms-framework/sms-framework.routes";
import { AirSafetyMeetingRepository } from "./air-safety-meetings/air-safety-meeting.repository";
import { AirSafetyMeetingService } from "./air-safety-meetings/air-safety-meeting.service";
import { AirSafetyMeetingController } from "./air-safety-meetings/air-safety-meeting.controller";
import { createAirSafetyMeetingRouter } from "./air-safety-meetings/air-safety-meeting.routes";
import { SafetyEventRepository } from "./safety-events/safety-event.repository";
import { SafetyEventService } from "./safety-events/safety-event.service";
import { SafetyEventController } from "./safety-events/safety-event.controller";
import { createSafetyEventRouter } from "./safety-events/safety-event.routes";
import { ExternalOverlayRepository } from "./external-overlays/external-overlay.repository";
import { ExternalOverlayService } from "./external-overlays/external-overlay.service";
import { ExternalOverlayController } from "./external-overlays/external-overlay.controller";
import { createExternalOverlayRouter } from "./external-overlays/external-overlay.routes";
import { TrafficConflictAssessmentService } from "./conflict-assessment/traffic-conflict-assessment.service";
import { TrafficConflictAssessmentController } from "./conflict-assessment/traffic-conflict-assessment.controller";
import { createTrafficConflictAssessmentRouter } from "./conflict-assessment/traffic-conflict-assessment.routes";

const projectRoot = path.resolve(__dirname, "..");
const staticRoot = path.resolve(projectRoot, "static");

function readStaticHtml(fileName: string): string {
  return fs.readFileSync(path.resolve(staticRoot, fileName), "utf8");
}

dotenv.config({
  path: path.resolve(projectRoot, ".env"),
  quiet: true,
});



if (process.env.NODE_ENV !== "test") {
  console.log("PG env check", {
    envPath: path.resolve(projectRoot, ".env"),
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
app.use("/static", express.static(staticRoot));

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

const missionLifecyclePolicy = new MissionLifecyclePolicy();
const missionTelemetryRepo = new MissionTelemetryRepository();
const alertRepository = new AlertRepository();
const alertService = new AlertService(pool, alertRepository);
const alertController = new AlertController(alertService);

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
const missionReplayService = new MissionReplayService(
  pool,
  missionRepo,
  missionTelemetryRepo,
);
const missionReplayController = new MissionReplayController(missionReplayService);

const timelineService = new TimelineService(pool);
const platformRepository = new PlatformRepository();
const platformService = new PlatformService(pool, platformRepository);
const platformController = new PlatformController(platformService);
const pilotRepository = new PilotRepository();
const pilotService = new PilotService(pool, pilotRepository);
const pilotController = new PilotController(pilotService);
const missionRiskRepository = new MissionRiskRepository();
const missionRiskService = new MissionRiskService(pool, missionRiskRepository);
const missionRiskController = new MissionRiskController(missionRiskService);
const airspaceComplianceRepository = new AirspaceComplianceRepository();
const airspaceComplianceService = new AirspaceComplianceService(
  pool,
  airspaceComplianceRepository,
);
const airspaceComplianceController = new AirspaceComplianceController(
  airspaceComplianceService,
);
const auditEvidenceRepository = new AuditEvidenceRepository();
const missionService = new MissionService(
  db,
  missionRepo,
  missionEventRepo,
  platformService,
  pilotService,
  missionRiskService,
  airspaceComplianceService,
  auditEvidenceRepository,
);
const auditEvidenceService = new AuditEvidenceService(
  pool,
  auditEvidenceRepository,
  missionService,
);
const auditEvidenceController = new AuditEvidenceController(
  auditEvidenceService,
);
const missionPlanningRepository = new MissionPlanningRepository();
const missionPlanningService = new MissionPlanningService(
  pool,
  missionPlanningRepository,
  missionRiskRepository,
  airspaceComplianceRepository,
  auditEvidenceService,
  missionService,
  missionTelemetryRepo,
);
const missionController = new MissionController(
  missionService,
  missionPlanningService,
);
const missionPlanningController = new MissionPlanningController(
  missionPlanningService,
);
const smsFrameworkRepository = new SmsFrameworkRepository();
const smsFrameworkService = new SmsFrameworkService(
  pool,
  smsFrameworkRepository,
);
const smsFrameworkController = new SmsFrameworkController(smsFrameworkService);
const airSafetyMeetingRepository = new AirSafetyMeetingRepository();
const airSafetyMeetingService = new AirSafetyMeetingService(
  pool,
  airSafetyMeetingRepository,
);
const airSafetyMeetingController = new AirSafetyMeetingController(
  airSafetyMeetingService,
);
const safetyEventRepository = new SafetyEventRepository();
const safetyEventService = new SafetyEventService(pool, safetyEventRepository);
const safetyEventController = new SafetyEventController(safetyEventService);
const externalOverlayRepository = new ExternalOverlayRepository();
const externalOverlayService = new ExternalOverlayService(
  pool,
  externalOverlayRepository,
);
const externalOverlayController = new ExternalOverlayController(
  externalOverlayService,
);
const trafficConflictAssessmentService = new TrafficConflictAssessmentService(
  pool,
  missionRepo,
  missionTelemetryRepo,
  externalOverlayRepository,
);
const trafficConflictAssessmentController =
  new TrafficConflictAssessmentController(trafficConflictAssessmentService);

app.use("/mission-plans", createMissionPlanningRouter(missionPlanningController));
app.use("/sms", createSmsFrameworkRouter(smsFrameworkController));
app.use(
  "/air-safety-meetings",
  createAirSafetyMeetingRouter(airSafetyMeetingController),
);
app.use("/safety-events", createSafetyEventRouter(safetyEventController));
app.use("/missions", createMissionRouter(missionController));
app.use("/missions", createExternalOverlayRouter(externalOverlayController));
app.use(
  "/missions",
  createTrafficConflictAssessmentRouter(trafficConflictAssessmentController),
);
app.use("/missions", createMissionRiskRouter(missionRiskController));
app.use("/missions", createAirspaceComplianceRouter(airspaceComplianceController));
app.use("/missions", createAuditEvidenceRouter(auditEvidenceController));
app.use("/missions", createMissionReplayRouter(missionReplayController));
app.use("/missions", createMissionTelemetryRouter(missionTelemetryController));
app.use("/missions", createAlertRouter(alertController));
app.use("/platforms", createPlatformRouter(platformController));
app.use("/pilots", createPilotRouter(pilotController));
app.use("/timeline", createTimelineRouter(timelineService));
app.get("/operator/mission-workspace", (_req, res) => {
  res.type("html").send(readStaticHtml("operator-mission-workspace.html"));
});
app.get("/operator/missions/:missionId", (_req, res) => {
  res.type("html").send(readStaticHtml("operator-mission-workspace.html"));
});
app.get("/operator/live-operations-map", (_req, res) => {
  res.type("html").send(readStaticHtml("operator-live-operations-map.html"));
});
app.get("/operator/missions/:missionId/live-operations", (_req, res) => {
  res.type("html").send(readStaticHtml("operator-live-operations-map.html"));
});
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
      blockingReasons?: string[];
    };

    return res.status(appError.statusCode).json({
      error: {
        message: appError.message,
        type: appError.type ?? appError.code?.toLowerCase() ?? "application_error",
        blockingReasons: appError.blockingReasons,
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


   



