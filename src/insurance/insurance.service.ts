import type { Pool } from "pg";
import {
  InsuranceDocumentNotFoundError,
  InsuranceMissionNotFoundError,
  InsuranceProfileNotFoundError,
} from "./insurance.errors";
import { InsuranceRepository } from "./insurance.repository";
import type {
  ActivateInsuranceProfileInput,
  CreateInsuranceDocumentInput,
  InsuranceAssessment,
  InsuranceAssessmentReason,
  UploadInsurancePolicyInput,
} from "./insurance.types";
import {
  validateActivateInsuranceProfileInput,
  validateCreateInsuranceDocumentInput,
  validateUploadInsurancePolicyInput,
} from "./insurance.validators";

export class InsuranceService {
  private static readonly RENEWAL_SOON_DAYS = 30;

  constructor(
    private readonly pool: Pool,
    private readonly insuranceRepository: InsuranceRepository,
  ) {}

  async createInsuranceDocument(
    organisationId: string,
    input: CreateInsuranceDocumentInput | undefined,
  ) {
    const validated = validateCreateInsuranceDocumentInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const document = await this.insuranceRepository.insertDocument(client, {
        organisationId,
        providerName: validated.providerName,
        policyNumber: validated.policyNumber,
        issueDate: validated.issueDate,
        effectiveFrom: validated.effectiveFrom,
        expiresAt: validated.expiresAt,
        uploadedBy: validated.uploadedBy,
      });

      const profile = await this.insuranceRepository.insertProfile(client, {
        organisationId,
        documentId: document.id,
        versionNumber: 1,
      });

      const conditions = [];
      for (const condition of validated.conditions) {
        conditions.push(
          await this.insuranceRepository.insertCondition(client, {
            profileId: profile.id,
            conditionCode: condition.conditionCode,
            conditionTitle: condition.conditionTitle,
            clauseReference: condition.clauseReference,
            conditionPayload: condition.conditionPayload,
          }),
        );
      }

      await client.query("COMMIT");
      return { document, profile, conditions };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async activateInsuranceProfile(
    profileId: string,
    input: ActivateInsuranceProfileInput | undefined,
  ) {
    const validated = validateActivateInsuranceProfileInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await this.insuranceRepository.getProfileById(
        client,
        profileId,
      );

      if (!existing) {
        throw new InsuranceProfileNotFoundError(profileId);
      }

      await this.insuranceRepository.supersedeActiveProfiles(
        client,
        existing.organisationId,
      );

      const profile = await this.insuranceRepository.activateProfile(
        client,
        profileId,
        validated.activatedBy,
      );
      await this.insuranceRepository.activateDocumentForProfile(client, profileId);
      const conditions = await this.insuranceRepository.getConditionsForProfile(
        client,
        profileId,
      );

      await client.query("COMMIT");
      return { profile, conditions };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getProfileOrganisationId(profileId: string): Promise<string> {
    const client = await this.pool.connect();

    try {
      const profile = await this.insuranceRepository.getProfileById(
        client,
        profileId,
      );

      if (!profile) {
        throw new InsuranceProfileNotFoundError(profileId);
      }

      return profile.organisationId;
    } finally {
      client.release();
    }
  }

  async uploadInsurancePolicy(
    documentId: string,
    input: UploadInsurancePolicyInput | undefined,
  ) {
    const validated = validateUploadInsurancePolicyInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await this.insuranceRepository.getDocumentById(
        client,
        documentId,
      );

      if (!existing) {
        throw new InsuranceDocumentNotFoundError(documentId);
      }

      const document = await this.insuranceRepository.updateDocumentUpload(
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
      const document = await this.insuranceRepository.getDocumentById(
        client,
        documentId,
      );

      if (!document) {
        throw new InsuranceDocumentNotFoundError(documentId);
      }

      return document.organisationId;
    } finally {
      client.release();
    }
  }

  async getMissionOrganisationId(missionId: string): Promise<string> {
    const client = await this.pool.connect();

    try {
      const mission = await this.insuranceRepository.getMissionGovernanceContext(
        client,
        missionId,
      );

      if (!mission) {
        throw new InsuranceMissionNotFoundError(missionId);
      }

      if (!mission.organisationId) {
        throw new InsuranceMissionNotFoundError(missionId);
      }

      return mission.organisationId;
    } finally {
      client.release();
    }
  }

  async assessMissionInsurance(missionId: string): Promise<InsuranceAssessment> {
    const client = await this.pool.connect();

    try {
      const mission = await this.insuranceRepository.getMissionGovernanceContext(
        client,
        missionId,
      );

      if (!mission) {
        throw new InsuranceMissionNotFoundError(missionId);
      }

      if (!mission.organisationId) {
        return {
          missionId,
          organisationId: null,
          result: "fail",
          reasons: [
            {
              code: "MISSION_ORGANISATION_MISSING",
              severity: "fail",
              message:
                "Mission has no organisation context for insurance assessment",
            },
          ],
          profile: null,
          document: null,
        };
      }

      const profile =
        await this.insuranceRepository.getLatestActiveProfileForOrganisation(
          client,
          mission.organisationId,
        );

      if (!profile) {
        return {
          missionId,
          organisationId: mission.organisationId,
          result: "fail",
          reasons: [
            {
              code: "INSURANCE_ACTIVE_PROFILE_MISSING",
              severity: "fail",
              message:
                "VerityATLAS indicates the operator does not currently have recorded evidence of insurance cover for this operation.",
            },
          ],
          profile: null,
          document: null,
        };
      }

      const document = await this.insuranceRepository.getDocumentById(
        client,
        profile.insuranceDocumentId,
      );

      const conditions = await this.insuranceRepository.getConditionsForProfile(
        client,
        profile.id,
      );
      const reasons: InsuranceAssessmentReason[] = [];
      const now = new Date();

      if (profile.reviewStatus !== "reviewed") {
        reasons.push({
          code: "INSURANCE_PROFILE_REVIEW_REQUIRED",
          severity: "warning",
          message:
            "The active insurance profile still requires accountable review before it should be relied on as fully current evidence.",
        });
      }

      if (document) {
        const effectiveFrom = new Date(document.effectiveFrom);
        const expiresAt = new Date(document.expiresAt);

        if (effectiveFrom > now) {
          reasons.push({
            code: "INSURANCE_DOCUMENT_NOT_YET_EFFECTIVE",
            severity: "fail",
            message:
              "VerityATLAS indicates the recorded insurance is not yet effective for this mission date window and accountable review is recommended before continuation.",
          });
        }

        if (expiresAt <= now) {
          reasons.push({
            code: "INSURANCE_DOCUMENT_EXPIRED",
            severity: "fail",
            message:
              "VerityATLAS indicates the recorded insurance appears to be outside its cover period and should be renewed, replaced, or reviewed before reliance.",
          });
        } else {
          const msUntilExpiry = expiresAt.getTime() - now.getTime();
          const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24);

          if (daysUntilExpiry <= InsuranceService.RENEWAL_SOON_DAYS) {
            reasons.push({
              code: "INSURANCE_DOCUMENT_RENEWAL_SOON",
              severity: "warning",
              message:
                "VerityATLAS indicates the recorded insurance is approaching renewal and should be reviewed before it becomes an operational pressure point.",
            });
          }
        }
      }

      const allowedOperationTypes = conditions
        .filter((condition) => condition.conditionCode === "ALLOWED_OPERATION_TYPE")
        .flatMap((condition) => {
          const allowed = condition.conditionPayload.allowedOperationTypes;
          return Array.isArray(allowed)
            ? allowed.filter((item): item is string => typeof item === "string")
            : [];
        });

      if (
        allowedOperationTypes.length > 0 &&
        mission.operationType &&
        !allowedOperationTypes.includes(mission.operationType)
      ) {
        const condition = conditions.find(
          (item) => item.conditionCode === "ALLOWED_OPERATION_TYPE",
        );
        reasons.push({
          code: "INSURANCE_OPERATION_TYPE_NOT_COVERED",
          severity: "fail",
          message:
            "VerityATLAS indicates the mission operation type may fall outside the recorded insurance profile. Consider changing the mission type or reviewing the policy conditions before continuation.",
          clauseReference: condition?.clauseReference ?? null,
        });
      }

      if (mission.requiresBvlos) {
        const bvlosCovered = conditions.find(
          (condition) =>
            condition.conditionCode === "BVLOS_COVERED" &&
            condition.conditionPayload.enabled === true,
        );
        const bvlosRequiresReview = conditions.find(
          (condition) =>
            condition.conditionCode === "BVLOS_REQUIRES_REVIEW" &&
            condition.conditionPayload.enabled === true,
        );

        if (!bvlosCovered) {
          reasons.push({
            code: "INSURANCE_BVLOS_NOT_COVERED",
            severity: "fail",
            message:
              "VerityATLAS indicates the mission requires BVLOS but the recorded insurance profile does not currently show BVLOS cover. Consider changing the mission method or obtaining accountable review before continuation.",
            clauseReference: null,
          });
        } else if (bvlosRequiresReview) {
          reasons.push({
            code: "INSURANCE_BVLOS_REVIEW_REQUIRED",
            severity: "warning",
            message:
              "VerityATLAS indicates the mission requires BVLOS and the recorded insurance profile calls for accountable review before continuation.",
            clauseReference: bvlosRequiresReview.clauseReference,
          });
        }
      }

      if (!reasons.some((reason) => reason.severity === "fail")) {
        reasons.push({
          code: "INSURANCE_WITHIN_PROFILE",
          severity: "pass",
          message: "Mission is within the recorded active insurance profile.",
        });
      }

      return {
        missionId,
        organisationId: mission.organisationId,
        result: reasons.some((reason) => reason.severity === "fail")
          ? "fail"
          : reasons.some((reason) => reason.severity === "warning")
            ? "warning"
            : "pass",
        reasons,
        profile,
        document,
      };
    } finally {
      client.release();
    }
  }
}
