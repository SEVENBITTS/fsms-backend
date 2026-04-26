export type PilotStatus = "active" | "inactive" | "suspended" | "retired";

export type PilotEvidenceStatus = "active" | "inactive" | "revoked";

export interface CreatePilotInput {
  displayName?: string;
  caaReference?: string | null;
  status?: PilotStatus;
  notes?: string | null;
}

export interface Pilot {
  id: string;
  displayName: string;
  caaReference: string | null;
  status: PilotStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePilotEvidenceInput {
  evidenceType?: string;
  title?: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
  status?: PilotEvidenceStatus;
  evidenceRef?: string | null;
  notes?: string | null;
}

export interface PilotEvidence {
  id: string;
  pilotId: string;
  evidenceType: string;
  title: string;
  issuedAt: string | null;
  expiresAt: string | null;
  status: PilotEvidenceStatus;
  evidenceRef: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PilotReadinessStatus {
  pilot: Pilot;
  currentEvidence: PilotEvidence[];
  expiredEvidence: PilotEvidence[];
  inactiveEvidence: PilotEvidence[];
}

export type PilotReadinessResult = "pass" | "warning" | "fail";

export type PilotReadinessReasonCode =
  | "PILOT_ACTIVE"
  | "PILOT_INACTIVE"
  | "PILOT_SUSPENDED"
  | "PILOT_RETIRED"
  | "PILOT_EVIDENCE_MISSING"
  | "PILOT_EVIDENCE_EXPIRED"
  | "PILOT_EVIDENCE_REVOKED";

export interface PilotReadinessReason {
  code: PilotReadinessReasonCode;
  severity: PilotReadinessResult;
  message: string;
  relatedEvidenceIds?: string[];
}

export interface PilotReadinessCheck {
  pilotId: string;
  result: PilotReadinessResult;
  reasons: PilotReadinessReason[];
  readinessStatus: PilotReadinessStatus;
}
