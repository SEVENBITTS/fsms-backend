export class OrganisationDocumentsValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "ORGANISATION_DOCUMENTS_VALIDATION_FAILED";
}

export class OrganisationDocumentNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "ORGANISATION_DOCUMENT_NOT_FOUND";

  constructor(documentId: string) {
    super(`Organisation document not found: ${documentId}`);
  }
}
