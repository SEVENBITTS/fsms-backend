export class StoredFilesValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "STORED_FILES_VALIDATION_FAILED";
}

export class StoredFileNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "STORED_FILE_NOT_FOUND";

  constructor(fileId: string) {
    super(`Stored file not found: ${fileId}`);
  }
}
