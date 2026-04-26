export interface CreateStoredFileInput {
  organisationId: string;
  originalFileName?: string;
  contentType?: string | null;
  sourceDocumentType?: string | null;
  uploadedBy?: string | null;
  fileBuffer: Buffer;
}

export interface StoredFile {
  id: string;
  organisationId: string;
  originalFileName: string;
  contentType: string | null;
  sourceDocumentType: string | null;
  fileSizeBytes: number;
  fileChecksum: string;
  storagePath: string;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
