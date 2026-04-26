import { AlertValidationError } from "./alert.errors";
import type {
  AcknowledgeAlertInput,
  RegulatoryAmendmentAlertInput,
  ResolveAlertInput,
} from "./alert.types";

const requiredTrimmed = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new AlertValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new AlertValidationError(`${fieldName} is required`);
  }

  return trimmed;
};

const requiredDate = (value: unknown, fieldName: string): string => {
  const trimmed = requiredTrimmed(value, fieldName);

  if (Number.isNaN(Date.parse(trimmed))) {
    throw new AlertValidationError(`${fieldName} must be a valid date`);
  }

  return trimmed;
};

const optionalDate = (value: unknown, fieldName: string): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  return requiredDate(value, fieldName);
};

const optionalStringArray = (
  value: unknown,
  fieldName: string,
): string[] => {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new AlertValidationError(`${fieldName} must be an array`);
  }

  return value.map((item, index) =>
    requiredTrimmed(item, `${fieldName}[${index}]`),
  );
};

export const validateRegulatoryAmendmentAlertInput = (
  input: unknown,
): RegulatoryAmendmentAlertInput => {
  if (!input || typeof input !== "object") {
    throw new AlertValidationError("Request body must be an object");
  }

  const body = input as Record<string, unknown>;

  return {
    sourceDocument: requiredTrimmed(body.sourceDocument, "sourceDocument"),
    previousVersion: requiredTrimmed(body.previousVersion, "previousVersion"),
    currentVersion: requiredTrimmed(body.currentVersion, "currentVersion"),
    publishedAt: requiredDate(body.publishedAt, "publishedAt"),
    effectiveFrom: optionalDate(body.effectiveFrom, "effectiveFrom"),
    amendmentSummary: requiredTrimmed(body.amendmentSummary, "amendmentSummary"),
    changeImpact: requiredTrimmed(body.changeImpact, "changeImpact"),
    affectedRequirementRefs: optionalStringArray(
      body.affectedRequirementRefs,
      "affectedRequirementRefs",
    ),
    reviewAction: requiredTrimmed(body.reviewAction, "reviewAction"),
  };
};

export const validateAcknowledgeAlertInput = (
  input: unknown,
): AcknowledgeAlertInput => {
  if (input === undefined || input === null) {
    return {};
  }

  if (typeof input !== "object") {
    throw new AlertValidationError("Request body must be an object");
  }

  const body = input as Record<string, unknown>;

  return {
    acknowledgedAt: optionalDate(body.acknowledgedAt, "acknowledgedAt") ?? undefined,
  };
};

export const validateResolveAlertInput = (input: unknown): ResolveAlertInput => {
  if (input === undefined || input === null) {
    return {};
  }

  if (typeof input !== "object") {
    throw new AlertValidationError("Request body must be an object");
  }

  const body = input as Record<string, unknown>;

  return {
    resolvedAt: optionalDate(body.resolvedAt, "resolvedAt") ?? undefined,
  };
};
