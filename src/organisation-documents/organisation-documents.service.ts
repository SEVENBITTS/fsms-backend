import type { Pool } from "pg";
import { InsuranceRepository } from "../insurance/insurance.repository";
import { OperationalAuthorityRepository } from "../operational-authority/operational-authority.repository";
import { PilotRepository } from "../pilots/pilot.repository";
import { OrganisationDocumentNotFoundError } from "./organisation-documents.errors";
import { OrganisationDocumentsRepository } from "./organisation-documents.repository";
import type {
  CreateOrganisationDocumentInput,
  OrganisationDocumentPortal,
  UploadOrganisationDocumentInput,
} from "./organisation-documents.types";
import {
  validateCreateOrganisationDocumentInput,
  validateUploadOrganisationDocumentInput,
} from "./organisation-documents.validators";

export class OrganisationDocumentsService {
  private static readonly RENEWAL_SOON_DAYS = 30;

  constructor(
    private readonly pool: Pool,
    private readonly organisationDocumentsRepository: OrganisationDocumentsRepository,
    private readonly operationalAuthorityRepository: OperationalAuthorityRepository,
    private readonly insuranceRepository: InsuranceRepository,
    private readonly pilotRepository: PilotRepository,
  ) {}

  async createOrganisationDocument(
    organisationId: string,
    input: CreateOrganisationDocumentInput | undefined,
  ) {
    const validated = validateCreateOrganisationDocumentInput(input);
    const client = await this.pool.connect();

    try {
      const document = await this.organisationDocumentsRepository.insertDocument(
        client,
        {
          organisationId,
          ...validated,
        },
      );

      return { document };
    } finally {
      client.release();
    }
  }

  async uploadOrganisationDocument(
    documentId: string,
    input: UploadOrganisationDocumentInput | undefined,
  ) {
    const validated = validateUploadOrganisationDocumentInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await this.organisationDocumentsRepository.getDocumentById(
        client,
        documentId,
      );

      if (!existing) {
        throw new OrganisationDocumentNotFoundError(documentId);
      }

      const document = await this.organisationDocumentsRepository.updateDocumentUpload(
        client,
        documentId,
        validated,
      );

      await client.query("COMMIT");
      return { document };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getDocumentOrganisationId(documentId: string): Promise<string> {
    const client = await this.pool.connect();

    try {
      const document = await this.organisationDocumentsRepository.getDocumentById(
        client,
        documentId,
      );

      if (!document) {
        throw new OrganisationDocumentNotFoundError(documentId);
      }

      return document.organisationId;
    } finally {
      client.release();
    }
  }

  async listOrganisationDocuments(organisationId: string) {
    const client = await this.pool.connect();

    try {
      const documents =
        await this.organisationDocumentsRepository.listDocumentsByOrganisation(
          client,
          organisationId,
        );

      return { organisationId, documents };
    } finally {
      client.release();
    }
  }

  async getDocumentPortal(organisationId: string): Promise<OrganisationDocumentPortal> {
    const client = await this.pool.connect();

    try {
      const operationalAuthorityDocuments =
        await this.operationalAuthorityRepository.listDocumentsByOrganisation(
          client,
          organisationId,
        );
      const operationalAuthorityProfiles =
        await this.operationalAuthorityRepository.listProfilesByOrganisation(
          client,
          organisationId,
        );
      const insuranceDocuments =
        await this.insuranceRepository.listDocumentsByOrganisation(
          client,
          organisationId,
        );
      const supportingDocuments =
        await this.organisationDocumentsRepository.listDocumentsByOrganisation(
          client,
          organisationId,
        );
      const pilots = await this.pilotRepository.listPilots(client);

      const now = Date.now();
      const renewalSoonMs =
        OrganisationDocumentsService.RENEWAL_SOON_DAYS *
        24 *
        60 *
        60 *
        1000;
      const allDocuments = [
        ...operationalAuthorityDocuments,
        ...insuranceDocuments,
        ...supportingDocuments,
      ];
      const expiringSoon = allDocuments.filter((document) => {
        if (!document.expiresAt) {
          return false;
        }

        const expiresAt = new Date(document.expiresAt).getTime();
        return expiresAt > now && expiresAt - now <= renewalSoonMs;
      }).length;

      const missingSourceUploads = allDocuments.filter(
        (document) => !document.uploadedFileId,
      ).length;

      return {
        organisationId,
        summary: {
          totalDocuments: allDocuments.length,
          operationalAuthorityDocuments: operationalAuthorityDocuments.length,
          insuranceDocuments: insuranceDocuments.length,
          supportingDocuments: supportingDocuments.length,
          missingSourceUploads,
          expiringSoon,
        },
        sections: {
          operationalAuthorityDocuments,
          operationalAuthorityProfiles,
          insuranceDocuments,
          supportingDocuments,
          pilots,
        },
      };
    } finally {
      client.release();
    }
  }
}
