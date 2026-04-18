import type { CreateAirspaceComplianceInput } from "../airspace-compliance/airspace-compliance.types";
import type { CreateMissionRiskInput } from "../mission-risk/mission-risk.types";

export interface CreateMissionPlanningDraftInput {
  missionPlanId?: string | null;
  platformId?: string | null;
  pilotId?: string | null;
  riskInput?: CreateMissionRiskInput | null;
  airspaceInput?: CreateAirspaceComplianceInput | null;
}

export interface MissionPlanningChecklistItem {
  key: "platform" | "pilot" | "risk" | "airspace";
  status: "present" | "missing";
  message: string;
}

export interface MissionPlanningDraft {
  missionId: string;
  missionPlanId: string | null;
  status: "draft";
  platformId: string | null;
  pilotId: string | null;
  placeholders: {
    platformAssigned: boolean;
    pilotAssigned: boolean;
    riskInputPresent: boolean;
    airspaceInputPresent: boolean;
  };
  checklist: MissionPlanningChecklistItem[];
  readinessCheckAvailable: boolean;
}
