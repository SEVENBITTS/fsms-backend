import type { InsuranceDocument } from "../insurance/insurance.types";
import type {
  OperationalAuthorityDocument,
  OperationalAuthorityProfile,
} from "../operational-authority/operational-authority.types";
import type { Pilot } from "../pilots/pilot.types";

export type OrganisationDocumentCategory =
  | "certificate"
  | "training"
  | "maintenance"
  | "manual"
  | "policy"
  | "contract"
  | "other";

export type OrganisationDocumentStatus =
  | "draft"
  | "active"
  | "expired"
  | "superseded"
  | "archived";

export interface CreateOrganisationDocumentInput {
  category?: OrganisationDocumentCategory;
  title?: string;
  issuingBody?: string | null;
  referenceNumber?: string | null;
  issueDate?: string | null;
  effectiveFrom?: string | null;
  expiresAt?: string | null;
  tags?: string[] | null;
  uploadedBy?: string | null;
}

export interface UploadOrganisationDocumentInput {
  uploadedFileId?: string;
  sourceDocumentType?: string;
  uploadedFileName?: string | null;
  uploadedFileChecksum?: string | null;
  reviewNotes?: string | null;
  uploadedBy?: string | null;
}

export interface OrganisationDocument {
  id: string;
  organisationId: string;
  category: OrganisationDocumentCategory;
  title: string;
  status: OrganisationDocumentStatus;
  issuingBody: string | null;
  referenceNumber: string | null;
  issueDate: string | null;
  effectiveFrom: string | null;
  expiresAt: string | null;
  uploadedFileId: string | null;
  sourceDocumentType: string | null;
  uploadedFileName: string | null;
  uploadedFileChecksum: string | null;
  tags: string[];
  reviewNotes: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganisationDocumentPortalSummary {
  totalDocuments: number;
  operationalAuthorityDocuments: number;
  insuranceDocuments: number;
  supportingDocuments: number;
  missingSourceUploads: number;
  expiringSoon: number;
}

export interface OrganisationDocumentPortal {
  organisationId: string;
  summary: OrganisationDocumentPortalSummary;
  sections: {
    operationalAuthorityDocuments: OperationalAuthorityDocument[];
    operationalAuthorityProfiles: OperationalAuthorityProfile[];
    insuranceDocuments: InsuranceDocument[];
    supportingDocuments: OrganisationDocument[];
    pilots: Pilot[];
  };
}
