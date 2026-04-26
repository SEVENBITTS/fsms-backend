import { StoredFilesValidationError } from "./stored-files.errors";
import type { CreateStoredFileInput } from "./stored-files.types";

function requiredTrimmed(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new StoredFilesValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new StoredFilesValidationError(`${fieldName} must not be empty`);
  }

  return trimmed;
}

function optionalTrimmed(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return requiredTrimmed(value, fieldName);
}

function sanitiseFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || "uploaded-file.bin";
}

export function validateCreateStoredFileInput(
  input: CreateStoredFileInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new StoredFilesValidationError("Stored file input must be an object");
  }

  if (!Buffer.isBuffer(input.fileBuffer) || input.fileBuffer.length === 0) {
    throw new StoredFilesValidationError("fileBuffer must contain uploaded bytes");
  }

  return {
    organisationId: requiredTrimmed(input.organisationId, "organisationId"),
    originalFileName: sanitiseFileName(
      requiredTrimmed(input.originalFileName, "originalFileName"),
    ),
    contentType: optionalTrimmed(input.contentType, "contentType"),
    sourceDocumentType: optionalTrimmed(
      input.sourceDocumentType,
      "sourceDocumentType",
    ),
    uploadedBy: optionalTrimmed(input.uploadedBy, "uploadedBy"),
    fileBuffer: input.fileBuffer,
  };
}
