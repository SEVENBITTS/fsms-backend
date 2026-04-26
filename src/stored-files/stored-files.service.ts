import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import type { Pool } from "pg";
import { StoredFileNotFoundError } from "./stored-files.errors";
import { StoredFilesRepository } from "./stored-files.repository";
import type { CreateStoredFileInput } from "./stored-files.types";
import { validateCreateStoredFileInput } from "./stored-files.validators";

export class StoredFilesService {
  constructor(
    private readonly pool: Pool,
    private readonly storedFilesRepository: StoredFilesRepository,
    private readonly uploadsRoot: string,
  ) {}

  async createStoredFile(input: CreateStoredFileInput | undefined) {
    const validated = validateCreateStoredFileInput(input);
    const client = await this.pool.connect();

    const checksum = createHash("sha256")
      .update(validated.fileBuffer)
      .digest("hex");

    try {
      await client.query("BEGIN");

      const directoryPath = path.resolve(
        this.uploadsRoot,
        validated.organisationId,
      );
      await fs.mkdir(directoryPath, { recursive: true });

      const safeStorageName = `${Date.now()}_${validated.originalFileName}`;
      const absoluteStoragePath = path.resolve(directoryPath, safeStorageName);
      await fs.writeFile(absoluteStoragePath, validated.fileBuffer);

      const relativeStoragePath = path
        .relative(process.cwd(), absoluteStoragePath)
        .replaceAll("\\", "/");

      const storedFile = await this.storedFilesRepository.insertStoredFile(
        client,
        {
          organisationId: validated.organisationId,
          originalFileName: validated.originalFileName,
          contentType: validated.contentType,
          sourceDocumentType: validated.sourceDocumentType,
          fileSizeBytes: validated.fileBuffer.length,
          fileChecksum: checksum,
          storagePath: relativeStoragePath,
          uploadedBy: validated.uploadedBy,
        },
      );

      await client.query("COMMIT");
      return { file: storedFile };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getStoredFileMetadata(fileId: string) {
    const client = await this.pool.connect();

    try {
      const storedFile = await this.storedFilesRepository.getStoredFileById(
        client,
        fileId,
      );

      if (!storedFile) {
        throw new StoredFileNotFoundError(fileId);
      }

      return { file: storedFile };
    } finally {
      client.release();
    }
  }

  async getStoredFileContent(fileId: string) {
    const client = await this.pool.connect();

    try {
      const storedFile = await this.storedFilesRepository.getStoredFileById(
        client,
        fileId,
      );

      if (!storedFile) {
        throw new StoredFileNotFoundError(fileId);
      }

      const absoluteStoragePath = path.resolve(process.cwd(), storedFile.storagePath);
      const fileBuffer = await fs.readFile(absoluteStoragePath);

      return { file: storedFile, fileBuffer };
    } finally {
      client.release();
    }
  }
}
