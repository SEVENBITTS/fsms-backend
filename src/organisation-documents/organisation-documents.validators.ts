import { OrganisationDocumentsValidationError } from "./organisation-documents.errors";
import type {
  CreateOrganisationDocumentInput,
  OrganisationDocumentCategory,
  UploadOrganisationDocumentInput,
} from "./organisation-documents.types";

const DOCUMENT_CATEGORIES = new Set<OrganisationDocumentCategory>([
  "certificate",
  "training",
  "maintenance",
  "manual",
  "policy",
  "contract",
  "other",
]);

function requiredTrimmed(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new OrganisationDocumentsValidationError(
      `${fieldName} must be a string`,
    );
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new OrganisationDocumentsValidationError(
      `${fieldName} must not be empty`,
    );
  }

  return trimmed;
}

function optionalTrimmed(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return requiredTrimmed(value, fieldName);
}

function optionalIsoDate(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = new Date(requiredTrimmed(value, fieldName));

  if (Number.isNaN(parsed.getTime())) {
    throw new OrganisationDocumentsValidationError(
      `${fieldName} must be a valid ISO date`,
    );
  }

  return parsed.toISOString();
}

export function validateCreateOrganisationDocumentInput(
  input: CreateOrganisationDocumentInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new OrganisationDocumentsValidationError("Request body must be an object");
  }

  if (
    typeof input.category !== "string" ||
    !DOCUMENT_CATEGORIES.has(input.category as OrganisationDocumentCategory)
  ) {
    throw new OrganisationDocumentsValidationError("category is not supported");
  }

  const issueDate = optionalIsoDate(input.issueDate, "issueDate");
  const effectiveFrom = optionalIsoDate(input.effectiveFrom, "effectiveFrom");
  const expiresAt = optionalIsoDate(input.expiresAt, "expiresAt");

  if (effectiveFrom && expiresAt && new Date(expiresAt) <= new Date(effectiveFrom)) {
    throw new OrganisationDocumentsValidationError(
      "expiresAt must be after effectiveFrom",
    );
  }

  const tags =
    input.tags === undefined || input.tags === null
      ? []
      : Array.isArray(input.tags)
        ? input.tags.map((tag, index) => requiredTrimmed(tag, `tags[${index}]`))
        : (() => {
            throw new OrganisationDocumentsValidationError(
              "tags must be an array of strings",
            );
          })();

  return {
    category: input.category as OrganisationDocumentCategory,
    title: requiredTrimmed(input.title, "title"),
    issuingBody: optionalTrimmed(input.issuingBody, "issuingBody"),
    referenceNumber: optionalTrimmed(input.referenceNumber, "referenceNumber"),
    issueDate,
    effectiveFrom,
    expiresAt,
    tags,
    uploadedBy: optionalTrimmed(input.uploadedBy, "uploadedBy"),
  };
}

export function validateUploadOrganisationDocumentInput(
  input: UploadOrganisationDocumentInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new OrganisationDocumentsValidationError("Request body must be an object");
  }

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
    reviewNotes: optionalTrimmed(input.reviewNotes, "reviewNotes"),
    uploadedBy: optionalTrimmed(input.uploadedBy, "uploadedBy"),
  };
}
