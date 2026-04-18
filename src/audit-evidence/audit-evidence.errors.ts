export class AuditEvidenceValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "AUDIT_EVIDENCE_VALIDATION_FAILED";
}

export class AuditEvidenceMissionNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "MISSION_NOT_FOUND";

  constructor(missionId: string) {
    super(`Mission not found: ${missionId}`);
  }
}

export class AuditEvidenceSnapshotNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "AUDIT_EVIDENCE_SNAPSHOT_NOT_FOUND";

  constructor(snapshotId: string) {
    super(`Audit evidence snapshot not found for mission: ${snapshotId}`);
  }
}

export class AuditEvidenceMissionNotCompletedError extends Error {
  readonly statusCode = 409;
  readonly code = "MISSION_NOT_COMPLETED";

  constructor(missionId: string, status: string) {
    super(
      `Mission ${missionId} must be completed before post-operation evidence can be captured; current status is ${status}`,
    );
  }
}

export class PostOperationEvidenceSnapshotNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "POST_OPERATION_EVIDENCE_SNAPSHOT_NOT_FOUND";

  constructor(snapshotId: string) {
    super(`Post-operation evidence snapshot not found for mission: ${snapshotId}`);
  }
}

export class PostOperationAuditSignoffAlreadyExistsError extends Error {
  readonly statusCode = 409;
  readonly code = "POST_OPERATION_AUDIT_SIGNOFF_ALREADY_EXISTS";

  constructor(snapshotId: string) {
    super(
      `Post-operation audit sign-off already exists for snapshot: ${snapshotId}`,
    );
  }
}
