import { InsuranceValidationError } from "./insurance.errors";
import type {
  ActivateInsuranceProfileInput,
  CreateInsuranceConditionInput,
  CreateInsuranceDocumentInput,
  InsuranceConditionCode,
  UploadInsurancePolicyInput,
} from "./insurance.types";

const CONDITION_CODES = new Set<InsuranceConditionCode>([
  "ALLOWED_OPERATION_TYPE",
  "BVLOS_COVERED",
  "BVLOS_REQUIRES_REVIEW",
]);

function requiredTrimmed(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new InsuranceValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new InsuranceValidationError(`${fieldName} must not be empty`);
  }

  return trimmed;
}

function optionalTrimmed(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return requiredTrimmed(value, fieldName);
}

function requiredIsoDate(value: unknown, fieldName: string): string {
  const parsed = new Date(requiredTrimmed(value, fieldName));

  if (Number.isNaN(parsed.getTime())) {
    throw new InsuranceValidationError(`${fieldName} must be a valid ISO date`);
  }

  return parsed.toISOString();
}

function requiredConditionCode(value: unknown): InsuranceConditionCode {
  if (typeof value !== "string" || !CONDITION_CODES.has(value as InsuranceConditionCode)) {
    throw new InsuranceValidationError("conditionCode is not supported");
  }

  return value as InsuranceConditionCode;
}

function requiredConditionPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InsuranceValidationError("conditionPayload must be an object");
  }

  return value as Record<string, unknown>;
}

function validateCondition(
  input: CreateInsuranceConditionInput,
): CreateInsuranceConditionInput & {
  conditionCode: InsuranceConditionCode;
  conditionTitle: string;
  clauseReference: string | null;
  conditionPayload: Record<string, unknown>;
} {
  const conditionCode = requiredConditionCode(input.conditionCode);
  const conditionPayload = requiredConditionPayload(input.conditionPayload);

  if (
    conditionCode === "BVLOS_COVERED" ||
    conditionCode === "BVLOS_REQUIRES_REVIEW"
  ) {
    if (typeof conditionPayload.enabled !== "boolean") {
      throw new InsuranceValidationError("conditionPayload.enabled must be a boolean");
    }
  }

  if (conditionCode === "ALLOWED_OPERATION_TYPE") {
    if (
      !Array.isArray(conditionPayload.allowedOperationTypes) ||
      conditionPayload.allowedOperationTypes.length === 0
    ) {
      throw new InsuranceValidationError(
        "ALLOWED_OPERATION_TYPE requires a non-empty allowedOperationTypes array",
      );
    }
  }

  return {
    conditionCode,
    conditionTitle: requiredTrimmed(input.conditionTitle, "conditionTitle"),
    clauseReference: optionalTrimmed(input.clauseReference, "clauseReference"),
    conditionPayload,
  };
}

export function validateCreateInsuranceDocumentInput(
  input: CreateInsuranceDocumentInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new InsuranceValidationError("Request body must be an object");
  }

  const issueDate = requiredIsoDate(input.issueDate, "issueDate");
  const effectiveFrom = requiredIsoDate(input.effectiveFrom, "effectiveFrom");
  const expiresAt = requiredIsoDate(input.expiresAt, "expiresAt");

  if (new Date(expiresAt) <= new Date(effectiveFrom)) {
    throw new InsuranceValidationError("expiresAt must be after effectiveFrom");
  }

  const conditions = Array.isArray(input.conditions)
    ? input.conditions.map((condition) => validateCondition(condition))
    : [];

  return {
    providerName: requiredTrimmed(input.providerName, "providerName"),
    policyNumber: requiredTrimmed(input.policyNumber, "policyNumber"),
    issueDate,
    effectiveFrom,
    expiresAt,
    uploadedBy: optionalTrimmed(input.uploadedBy, "uploadedBy"),
    conditions,
  };
}

export function validateActivateInsuranceProfileInput(
  input: ActivateInsuranceProfileInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new InsuranceValidationError("Request body must be an object");
  }

  return {
    activatedBy: requiredTrimmed(input.activatedBy, "activatedBy"),
  };
}

export function validateUploadInsurancePolicyInput(
  input: UploadInsurancePolicyInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new InsuranceValidationError("Request body must be an object");
  }

  const policyScheduleRefs =
    input.policyScheduleRefs === undefined || input.policyScheduleRefs === null
      ? []
      : Array.isArray(input.policyScheduleRefs)
        ? input.policyScheduleRefs.map((item, index) =>
            requiredTrimmed(item, `policyScheduleRefs[${index}]`),
          )
        : (() => {
            throw new InsuranceValidationError(
              "policyScheduleRefs must be an array of strings",
            );
          })();

  return {
    uploadedFileId: requiredTrimmed(input.uploadedFileId, "uploadedFileId"),
    sourceDocumentType: requiredTrimmed(
      input.sourceDocumentType,
      "sourceDocumentType",
    ),
    uploadedFileName: optionalTrimmed(input.uploadedFileName, "uploadedFileName"),
    uploadedFileChecksum: optionalTrimmed(
      input.uploadedFileChecksum,
      "uploadedFileChecksum",
    ),
    policyScheduleRefs,
    documentReviewNotes: optionalTrimmed(
      input.documentReviewNotes,
      "documentReviewNotes",
    ),
    uploadedBy: optionalTrimmed(input.uploadedBy, "uploadedBy"),
  };
}
