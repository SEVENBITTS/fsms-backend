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
import { OperationalAuthorityRepository } from "./operational-authority/operational-authority.repository";
import { OperationalAuthorityService } from "./operational-authority/operational-authority.service";
import { OperationalAuthorityController } from "./operational-authority/operational-authority.controller";
import {
  createOperationalAuthorityDocumentRouter,
  createOperationalAuthorityMissionRouter,
  createOperationalAuthorityOrganisationRouter,
  createOperationalAuthorityPilotAuthorisationRouter,
  createOperationalAuthorityProfileRouter,
  createOperationalAuthoritySopChangeRecommendationRouter,
} from "./operational-authority/operational-authority.routes";
import { InsuranceRepository } from "./insurance/insurance.repository";
import { InsuranceService } from "./insurance/insurance.service";
import { InsuranceController } from "./insurance/insurance.controller";
import {
  createInsuranceDocumentRouter,
  createInsuranceMissionRouter,
  createInsuranceOrganisationRouter,
  createInsuranceProfileRouter,
} from "./insurance/insurance.routes";
import { MissionGovernanceService } from "./mission-governance/mission-governance.service";
import { MissionGovernanceController } from "./mission-governance/mission-governance.controller";
import { createMissionGovernanceRouter } from "./mission-governance/mission-governance.routes";
import { RiskMapRepository } from "./risk-map/risk-map.repository";
import { RiskMapService } from "./risk-map/risk-map.service";
import { RiskMapController } from "./risk-map/risk-map.controller";
import { createRiskMapRouter } from "./risk-map/risk-map.routes";
import { OrganisationDocumentsRepository } from "./organisation-documents/organisation-documents.repository";
import { OrganisationDocumentsService } from "./organisation-documents/organisation-documents.service";
import { OrganisationDocumentsController } from "./organisation-documents/organisation-documents.controller";
import {
  createOrganisationDocumentsOrganisationRouter,
  createOrganisationDocumentsUploadRouter,
} from "./organisation-documents/organisation-documents.routes";
import { StoredFilesRepository } from "./stored-files/stored-files.repository";
import { StoredFilesService } from "./stored-files/stored-files.service";
import { StoredFilesController } from "./stored-files/stored-files.controller";
import {
  createStoredFilesOrganisationRouter,
  createStoredFilesRouter,
} from "./stored-files/stored-files.routes";
import { UsersRepository } from "./users/users.repository";
import { UsersService } from "./users/users.service";
import { UsersController } from "./users/users.controller";
import { createUsersRouter } from "./users/users.routes";
import { OrganisationMembershipsRepository } from "./organisation-memberships/organisation-memberships.repository";
import { OrganisationMembershipsService } from "./organisation-memberships/organisation-memberships.service";
import { OrganisationMembershipsController } from "./organisation-memberships/organisation-memberships.controller";
import { createOrganisationMembershipsRouter } from "./organisation-memberships/organisation-memberships.routes";
import { AuthRepository } from "./auth/auth.repository";
import { AuthService } from "./auth/auth.service";
import { AuthController } from "./auth/auth.controller";
import { createAuthRouter } from "./auth/auth.routes";
import { createAuthMiddleware } from "./auth/auth.middleware";
import { MissionAccessRepository } from "./mission-access/mission-access.repository";
import { MissionAccessService } from "./mission-access/mission-access.service";
import { AccountableManagerDashboardRepository } from "./accountable-manager-dashboard/accountable-manager-dashboard.repository";
import { AccountableManagerDashboardService } from "./accountable-manager-dashboard/accountable-manager-dashboard.service";
import { AccountableManagerDashboardController } from "./accountable-manager-dashboard/accountable-manager-dashboard.controller";
import { createAccountableManagerDashboardRouter } from "./accountable-manager-dashboard/accountable-manager-dashboard.routes";
import { BRANDING } from "./config/branding";

const projectRoot = path.resolve(__dirname, "..");
const staticRoot = path.resolve(projectRoot, "static");
const uploadsRoot = path.resolve(projectRoot, "data", "uploads");

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
const smsFrameworkRepository = new SmsFrameworkRepository();
const alertService = new AlertService(
  pool,
  alertRepository,
  undefined,
  smsFrameworkRepository,
);
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
const usersRepository = new UsersRepository();
const usersService = new UsersService(pool, usersRepository);
const usersController = new UsersController(usersService);
const organisationMembershipsRepository = new OrganisationMembershipsRepository();
const organisationMembershipsService = new OrganisationMembershipsService(
  pool,
  organisationMembershipsRepository,
);
const organisationMembershipsController = new OrganisationMembershipsController(
  organisationMembershipsService,
);
const authRepository = new AuthRepository();
const authService = new AuthService(pool, authRepository, usersRepository);
const authController = new AuthController(authService);
const authMiddleware = createAuthMiddleware(authService);
const missionAccessRepository = new MissionAccessRepository();
const missionAccessService = new MissionAccessService(
  pool,
  missionAccessRepository,
);
const operationalAuthorityRepository = new OperationalAuthorityRepository();
const operationalAuthorityService = new OperationalAuthorityService(
  pool,
  operationalAuthorityRepository,
);
const operationalAuthorityController = new OperationalAuthorityController(
  operationalAuthorityService,
  organisationMembershipsService,
);
const insuranceRepository = new InsuranceRepository();
const insuranceService = new InsuranceService(pool, insuranceRepository);
const insuranceController = new InsuranceController(
  insuranceService,
  organisationMembershipsService,
);
const missionGovernanceService = new MissionGovernanceService(
  operationalAuthorityService,
  insuranceService,
  pilotService,
  missionAccessService,
);
const missionGovernanceController = new MissionGovernanceController(
  missionGovernanceService,
  missionAccessService,
  organisationMembershipsService,
);
const riskMapRepository = new RiskMapRepository();
const riskMapService = new RiskMapService(
  pool,
  riskMapRepository,
  missionGovernanceService,
  platformService,
  pilotService,
);
const riskMapController = new RiskMapController(
  riskMapService,
  missionAccessService,
  organisationMembershipsService,
);
const accountableManagerDashboardRepository =
  new AccountableManagerDashboardRepository();
const accountableManagerDashboardService =
  new AccountableManagerDashboardService(
    pool,
    accountableManagerDashboardRepository,
    riskMapService,
    operationalAuthorityRepository,
    insuranceRepository,
  );
const accountableManagerDashboardController =
  new AccountableManagerDashboardController(
    accountableManagerDashboardService,
    organisationMembershipsService,
  );
const organisationDocumentsRepository = new OrganisationDocumentsRepository();
const organisationDocumentsService = new OrganisationDocumentsService(
  pool,
  organisationDocumentsRepository,
  operationalAuthorityRepository,
  insuranceRepository,
  pilotRepository,
);
const organisationDocumentsController = new OrganisationDocumentsController(
  organisationDocumentsService,
  organisationMembershipsService,
);
const storedFilesRepository = new StoredFilesRepository();
const storedFilesService = new StoredFilesService(
  pool,
  storedFilesRepository,
  uploadsRoot,
);
const storedFilesController = new StoredFilesController(
  storedFilesService,
  organisationMembershipsService,
);

app.use("/mission-plans", createMissionPlanningRouter(missionPlanningController));
app.use("/users", createUsersRouter(usersController));
app.use("/auth", createAuthRouter(authController, authMiddleware));
app.use(
  "/organisations",
  createOrganisationMembershipsRouter(organisationMembershipsController),
);
app.use(
  "/organisations",
  authMiddleware,
  createOperationalAuthorityOrganisationRouter(operationalAuthorityController),
);
app.use(
  "/operational-authority-documents",
  authMiddleware,
  createOperationalAuthorityDocumentRouter(operationalAuthorityController),
);
app.use(
  "/operational-authority-profiles",
  authMiddleware,
  createOperationalAuthorityProfileRouter(operationalAuthorityController),
);
app.use(
  "/operational-authority-pilot-authorisations",
  authMiddleware,
  createOperationalAuthorityPilotAuthorisationRouter(operationalAuthorityController),
);
app.use(
  "/operational-authority-sop-change-recommendations",
  authMiddleware,
  createOperationalAuthoritySopChangeRecommendationRouter(
    operationalAuthorityController,
  ),
);
app.use(
  "/organisations",
  authMiddleware,
  createInsuranceOrganisationRouter(insuranceController),
);
app.use(
  "/organisations",
  authMiddleware,
  createAccountableManagerDashboardRouter(accountableManagerDashboardController),
);
app.use(
  "/organisations",
  authMiddleware,
  createOrganisationDocumentsOrganisationRouter(organisationDocumentsController),
);
app.use(
  "/organisations",
  authMiddleware,
  createStoredFilesOrganisationRouter(storedFilesController),
);
app.use(
  "/organisation-documents",
  authMiddleware,
  createOrganisationDocumentsUploadRouter(organisationDocumentsController),
);
app.use(
  "/insurance-documents",
  authMiddleware,
  createInsuranceDocumentRouter(insuranceController),
);
app.use("/files", authMiddleware, createStoredFilesRouter(storedFilesController));
app.use(
  "/insurance-profiles",
  authMiddleware,
  createInsuranceProfileRouter(insuranceController),
);
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
app.use(
  "/missions",
  authMiddleware,
  createOperationalAuthorityMissionRouter(operationalAuthorityController),
);
app.use("/missions", authMiddleware, createInsuranceMissionRouter(insuranceController));
app.use("/missions", authMiddleware, createMissionGovernanceRouter(missionGovernanceController));
app.use("/missions", authMiddleware, createRiskMapRouter(riskMapController));
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
app.get("/operator/document-portal", (_req, res) => {
  res.type("html").send(readStaticHtml("operator-document-portal.html"));
});
app.get("/operator/organisations/:organisationId/document-portal", (_req, res) => {
  res.type("html").send(readStaticHtml("operator-document-portal.html"));
});
app.get("/operator/accountable-manager-dashboard", (_req, res) => {
  res.type("html").send(readStaticHtml("accountable-manager-dashboard.html"));
});
app.get(
  "/operator/organisations/:organisationId/accountable-manager-dashboard",
  (_req, res) => {
    res.type("html").send(readStaticHtml("accountable-manager-dashboard.html"));
  },
);
app.get("/", (_req, res) => {
  res.status(200).send(BRANDING.backendStatusText);
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


   



