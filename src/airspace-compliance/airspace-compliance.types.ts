export type AirspaceClass = "a" | "b" | "c" | "d" | "e" | "f" | "g";

export type RestrictionStatus =
  | "clear"
  | "permission_required"
  | "restricted"
  | "prohibited";

export type PermissionStatus = "not_required" | "pending" | "granted" | "denied";

export interface CreateAirspaceComplianceInput {
  airspaceClass?: AirspaceClass;
  maxAltitudeFt?: number;
  restrictionStatus?: RestrictionStatus;
  permissionStatus?: PermissionStatus;
  controlledAirspace?: boolean;
  nearbyAerodrome?: boolean;
  evidenceRef?: string | null;
  notes?: string | null;
}

export interface AirspaceComplianceInput {
  id: string;
  missionId: string;
  airspaceClass: AirspaceClass;
  maxAltitudeFt: number;
  restrictionStatus: RestrictionStatus;
  permissionStatus: PermissionStatus;
  controlledAirspace: boolean;
  nearbyAerodrome: boolean;
  evidenceRef: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AirspaceComplianceResult = "pass" | "warning" | "fail";

export type AirspaceComplianceReasonCode =
  | "AIRSPACE_CLEAR"
  | "AIRSPACE_INPUT_MISSING"
  | "AIRSPACE_PERMISSION_PENDING"
  | "AIRSPACE_PERMISSION_DENIED"
  | "AIRSPACE_PERMISSION_REQUIRED"
  | "AIRSPACE_RESTRICTED"
  | "AIRSPACE_PROHIBITED"
  | "AIRSPACE_CONTROLLED"
  | "AIRSPACE_NEAR_AERODROME"
  | "AIRSPACE_ALTITUDE_REVIEW";

export interface AirspaceComplianceReason {
  code: AirspaceComplianceReasonCode;
  severity: AirspaceComplianceResult;
  message: string;
}

export interface AirspaceComplianceAssessment {
  missionId: string;
  result: AirspaceComplianceResult;
  reasons: AirspaceComplianceReason[];
  input: AirspaceComplianceInput | null;
}
