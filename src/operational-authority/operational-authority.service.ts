import type { Pool } from "pg";
import {
  OperationalAuthorityDocumentNotFoundError,
  OperationalAuthorityMissionNotFoundError,
  OperationalAuthorityPilotAuthorisationNotFoundError,
  OperationalAuthorityProfileNotFoundError,
} from "./operational-authority.errors";
import { OperationalAuthorityRepository } from "./operational-authority.repository";
import type {
  ActivateOperationalAuthorityProfileInput,
  CreateOperationalAuthorityDocumentInput,
  CreateOperationalAuthorityPilotAuthorisationInput,
  CreateOperationalAuthorityPilotAuthorisationReviewInput,
  CreateOperationalAuthoritySopDocumentInput,
  OperationalAuthorityAssessment,
  OperationalAuthorityAssessmentReason,
  OperationalAuthorityPilotAuthorisation,
  UpdateOperationalAuthorityPilotAuthorisationInput,
  UploadOperationalAuthorityDocumentInput,
} from "./operational-authority.types";
import {
  validateActivateOperationalAuthorityProfileInput,
  validateCreateOperationalAuthorityDocumentInput,
  validateCreateOperationalAuthorityPilotAuthorisationInput,
  validateCreateOperationalAuthorityPilotAuthorisationReviewInput,
  validateCreateOperationalAuthoritySopDocumentInput,
  validateUpdateOperationalAuthorityPilotAuthorisationInput,
  validateUploadOperationalAuthorityDocumentInput,
} from "./operational-authority.validators";

export class OperationalAuthorityService {
  private static readonly RENEWAL_SOON_DAYS = 30;

  constructor(
    private readonly pool: Pool,
    private readonly operationalAuthorityRepository: OperationalAuthorityRepository,
  ) {}

  async createOperationalAuthorityDocument(
    organisationId: string,
    input: CreateOperationalAuthorityDocumentInput | undefined,
  ) {
    const validated = validateCreateOperationalAuthorityDocumentInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const document =
        await this.operationalAuthorityRepository.insertDocument(client, {
          organisationId,
          authorityName: validated.authorityName,
          referenceNumber: validated.referenceNumber,
          issueDate: validated.issueDate,
          effectiveFrom: validated.effectiveFrom,
          expiresAt: validated.expiresAt,
          uploadedBy: validated.uploadedBy,
        });

      const profile = await this.operationalAuthorityRepository.insertProfile(
        client,
        {
          organisationId,
          documentId: document.id,
          versionNumber: 1,
        },
      );

      const conditions = [];
      for (const condition of validated.conditions) {
        conditions.push(
          await this.operationalAuthorityRepository.insertCondition(client, {
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

  async activateOperationalAuthorityProfile(
    profileId: string,
    input: ActivateOperationalAuthorityProfileInput | undefined,
  ) {
    const validated = validateActivateOperationalAuthorityProfileInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await this.operationalAuthorityRepository.getProfileById(
        client,
        profileId,
      );

      if (!existing) {
        throw new OperationalAuthorityProfileNotFoundError(profileId);
      }

      await this.operationalAuthorityRepository.supersedeActiveProfiles(
        client,
        existing.organisationId,
      );

      const profile = await this.operationalAuthorityRepository.activateProfile(
        client,
        profileId,
        validated.activatedBy,
      );
      await this.operationalAuthorityRepository.activateDocumentForProfile(
        client,
        profileId,
      );
      const conditions =
        await this.operationalAuthorityRepository.getConditionsForProfile(
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
      const profile = await this.operationalAuthorityRepository.getProfileById(
        client,
        profileId,
      );

      if (!profile) {
        throw new OperationalAuthorityProfileNotFoundError(profileId);
      }

      return profile.organisationId;
    } finally {
      client.release();
    }
  }

  async uploadOperationalAuthorityDocument(
    documentId: string,
    input: UploadOperationalAuthorityDocumentInput | undefined,
  ) {
    const validated = validateUploadOperationalAuthorityDocumentInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await this.operationalAuthorityRepository.getDocumentById(
        client,
        documentId,
      );

      if (!existing) {
        throw new OperationalAuthorityDocumentNotFoundError(documentId);
      }

      const document =
        await this.operationalAuthorityRepository.updateDocumentUpload(
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
      const document = await this.operationalAuthorityRepository.getDocumentById(
        client,
        documentId,
      );

      if (!document) {
        throw new OperationalAuthorityDocumentNotFoundError(documentId);
      }

      return document.organisationId;
    } finally {
      client.release();
    }
  }

  async getMissionOrganisationId(missionId: string): Promise<string> {
    const client = await this.pool.connect();

    try {
      const mission =
        await this.operationalAuthorityRepository.getMissionGovernanceContext(
          client,
          missionId,
        );

      if (!mission) {
        throw new OperationalAuthorityMissionNotFoundError(missionId);
      }

      if (!mission.organisationId) {
        throw new OperationalAuthorityMissionNotFoundError(missionId);
      }

      return mission.organisationId;
    } finally {
      client.release();
    }
  }

  async createSopDocument(
    profileId: string,
    input: CreateOperationalAuthoritySopDocumentInput | undefined,
  ) {
    const validated = validateCreateOperationalAuthoritySopDocumentInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const profile = await this.operationalAuthorityRepository.getProfileById(
        client,
        profileId,
      );

      if (!profile) {
        throw new OperationalAuthorityProfileNotFoundError(profileId);
      }

      const sopDocument =
        await this.operationalAuthorityRepository.insertSopDocument(client, {
          profileId,
          organisationId: profile.organisationId,
          sopCode: validated.sopCode,
          title: validated.title,
          version: validated.version,
          status: validated.status,
          owner: validated.owner,
          sourceDocumentId: validated.sourceDocumentId,
          sourceDocumentType: validated.sourceDocumentType,
          sourceClauseRefs: validated.sourceClauseRefs,
          linkedOaConditionIds: validated.linkedOaConditionIds,
          changeRecommendationScope: validated.changeRecommendationScope,
          reviewNotes: validated.reviewNotes,
        });

      await client.query("COMMIT");
      return { profile, sopDocument };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listSopDocuments(profileId: string) {
    const client = await this.pool.connect();

    try {
      const profile = await this.operationalAuthorityRepository.getProfileById(
        client,
        profileId,
      );

      if (!profile) {
        throw new OperationalAuthorityProfileNotFoundError(profileId);
      }

      const sopDocuments =
        await this.operationalAuthorityRepository.listSopDocumentsForProfile(
          client,
          profileId,
        );

      return { profile, sopDocuments };
    } finally {
      client.release();
    }
  }

  async createPilotAuthorisation(
    profileId: string,
    input: CreateOperationalAuthorityPilotAuthorisationInput | undefined,
  ) {
    const validated =
      validateCreateOperationalAuthorityPilotAuthorisationInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const profile = await this.operationalAuthorityRepository.getProfileById(
        client,
        profileId,
      );

      if (!profile) {
        throw new OperationalAuthorityProfileNotFoundError(profileId);
      }

      const authorisation =
        await this.operationalAuthorityRepository.insertPilotAuthorisation(
          client,
          {
            profileId,
            organisationId: profile.organisationId,
            pilotId: validated.pilotId,
            authorisationState: validated.authorisationState,
            allowedOperationTypes: validated.allowedOperationTypes,
            bvlosAuthorised: validated.bvlosAuthorised,
            requiresAccountableReview: validated.requiresAccountableReview,
            pendingAmendmentReference: validated.pendingAmendmentReference,
            pendingSubmittedAt: validated.pendingSubmittedAt,
            approvedAt: validated.approvedAt,
            notes: validated.notes,
          },
        );

      await client.query("COMMIT");
      return { authorisation };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listPilotAuthorisations(profileId: string) {
    const client = await this.pool.connect();

    try {
      const profile = await this.operationalAuthorityRepository.getProfileById(
        client,
        profileId,
      );

      if (!profile) {
        throw new OperationalAuthorityProfileNotFoundError(profileId);
      }

      const authorisations =
        await this.operationalAuthorityRepository.listPilotAuthorisationsForProfile(
          client,
          profileId,
        );

      return { profile, authorisations };
    } finally {
      client.release();
    }
  }

  async updatePilotAuthorisation(
    authorisationId: string,
    input: UpdateOperationalAuthorityPilotAuthorisationInput | undefined,
  ) {
    const validated =
      validateUpdateOperationalAuthorityPilotAuthorisationInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const existing =
        await this.operationalAuthorityRepository.getPilotAuthorisationById(
          client,
          authorisationId,
        );

      if (!existing) {
        throw new OperationalAuthorityPilotAuthorisationNotFoundError(
          authorisationId,
        );
      }

      const authorisation =
        await this.operationalAuthorityRepository.updatePilotAuthorisation(
          client,
          authorisationId,
          validated,
        );

      await client.query("COMMIT");
      return { authorisation };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createPilotAuthorisationReview(
    authorisationId: string,
    input: CreateOperationalAuthorityPilotAuthorisationReviewInput | undefined,
  ) {
    const validated =
      validateCreateOperationalAuthorityPilotAuthorisationReviewInput(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const authorisation =
        await this.operationalAuthorityRepository.getPilotAuthorisationById(
          client,
          authorisationId,
        );

      if (!authorisation) {
        throw new OperationalAuthorityPilotAuthorisationNotFoundError(
          authorisationId,
        );
      }

      const review =
        await this.operationalAuthorityRepository.insertPilotAuthorisationReview(
          client,
          {
            authorisationId,
            organisationId: authorisation.organisationId,
            decision: validated.decision,
            reviewedBy: validated.reviewedBy,
            reviewRationale: validated.reviewRationale,
            evidenceRef: validated.evidenceRef,
            reviewedAt: validated.reviewedAt,
          },
        );
      const reviews =
        await this.operationalAuthorityRepository.listPilotAuthorisationReviews(
          client,
          authorisationId,
        );

      await client.query("COMMIT");
      return { authorisation, review, reviews };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listPilotAuthorisationReviews(authorisationId: string) {
    const client = await this.pool.connect();

    try {
      const authorisation =
        await this.operationalAuthorityRepository.getPilotAuthorisationById(
          client,
          authorisationId,
        );

      if (!authorisation) {
        throw new OperationalAuthorityPilotAuthorisationNotFoundError(
          authorisationId,
        );
      }

      const reviews =
        await this.operationalAuthorityRepository.listPilotAuthorisationReviews(
          client,
          authorisationId,
        );

      return { authorisation, reviews };
    } finally {
      client.release();
    }
  }

  async getPilotAuthorisationOrganisationId(
    authorisationId: string,
  ): Promise<string> {
    const client = await this.pool.connect();

    try {
      const authorisation =
        await this.operationalAuthorityRepository.getPilotAuthorisationById(
          client,
          authorisationId,
        );

      if (!authorisation) {
        throw new OperationalAuthorityPilotAuthorisationNotFoundError(
          authorisationId,
        );
      }

      return authorisation.organisationId;
    } finally {
      client.release();
    }
  }

  async listProfilesByOrganisation(organisationId: string) {
    const client = await this.pool.connect();

    try {
      return await this.operationalAuthorityRepository.listProfilesByOrganisation(
        client,
        organisationId,
      );
    } finally {
      client.release();
    }
  }

  async assessMissionOperationalAuthority(
    missionId: string,
  ): Promise<OperationalAuthorityAssessment> {
    const client = await this.pool.connect();

    try {
      const mission =
        await this.operationalAuthorityRepository.getMissionGovernanceContext(
          client,
          missionId,
        );

      if (!mission) {
        throw new OperationalAuthorityMissionNotFoundError(missionId);
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
                "Mission has no organisation context for operational authority assessment",
            },
          ],
          profile: null,
          document: null,
          pilotAuthorisation: null,
        };
      }

      const profile =
        await this.operationalAuthorityRepository.getLatestActiveProfileForOrganisation(
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
              code: "OA_ACTIVE_PROFILE_MISSING",
              severity: "fail",
              message:
                "VerityATLAS indicates the operator does not currently have recorded evidence of an active OA for this operation.",
            },
          ],
          profile: null,
          document: null,
          pilotAuthorisation: null,
        };
      }

      const document =
        await this.operationalAuthorityRepository.getDocumentById(
          client,
          profile.operationalAuthorityDocumentId,
        );

      const reasons: OperationalAuthorityAssessmentReason[] = [];
      const now = new Date();

      if (profile.reviewStatus !== "reviewed") {
        reasons.push({
          code: "OA_PROFILE_REVIEW_REQUIRED",
          severity: "warning",
          message:
            "The active OA profile still requires accountable review before it should be relied on as fully current evidence.",
        });
      }

      if (document) {
        const effectiveFrom = new Date(document.effectiveFrom);
        const expiresAt = new Date(document.expiresAt);

        if (effectiveFrom > now) {
          reasons.push({
            code: "OA_DOCUMENT_NOT_YET_EFFECTIVE",
            severity: "fail",
            message:
              "The recorded OA exists but is not yet effective for this mission date window.",
          });
        }

        if (expiresAt <= now) {
          reasons.push({
            code: "OA_DOCUMENT_EXPIRED",
            severity: "fail",
            message:
              "VerityATLAS indicates the recorded OA has expired and should be renewed or replaced before reliance.",
          });
        } else {
          const msUntilExpiry = expiresAt.getTime() - now.getTime();
          const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24);

          if (daysUntilExpiry <= OperationalAuthorityService.RENEWAL_SOON_DAYS) {
            reasons.push({
              code: "OA_DOCUMENT_RENEWAL_SOON",
              severity: "warning",
              message:
                "The recorded OA is approaching renewal and should be reviewed before it becomes an operational threat.",
            });
          }
        }
      }

      const conditions =
        await this.operationalAuthorityRepository.getConditionsForProfile(
          client,
          profile.id,
        );

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
          code: "OA_OPERATION_TYPE_NOT_AUTHORISED",
          severity: "fail",
          message:
            "Mission operation type falls outside the recorded OA profile.",
          clauseReference: condition?.clauseReference ?? null,
        });
      }

      if (mission.requiresBvlos) {
        const bvlosAuthorised = conditions.find(
          (condition) =>
            condition.conditionCode === "BVLOS_AUTHORISED" &&
            condition.conditionPayload.enabled === true,
        );
        const bvlosRequiresReview = conditions.find(
          (condition) =>
            condition.conditionCode === "BVLOS_REQUIRES_REVIEW" &&
            condition.conditionPayload.enabled === true,
        );

        if (!bvlosAuthorised) {
          reasons.push({
            code: "OA_BVLOS_NOT_AUTHORISED",
            severity: "fail",
            message:
              "Mission requires BVLOS but the active OA profile does not record BVLOS authorisation.",
            clauseReference: null,
          });
        } else if (bvlosRequiresReview) {
          reasons.push({
            code: "OA_BVLOS_REQUIRES_REVIEW",
            severity: "warning",
            message:
              "Mission requires BVLOS and the active OA profile records an explicit review requirement.",
            clauseReference: bvlosRequiresReview.clauseReference,
          });
        }
      }

      let pilotAuthorisation: OperationalAuthorityPilotAuthorisation | null = null;

      if (mission.pilotId) {
        pilotAuthorisation =
          await this.operationalAuthorityRepository.getPilotAuthorisationForProfile(
            client,
            profile.id,
            mission.pilotId,
          );

        if (!pilotAuthorisation) {
          reasons.push({
            code: "OA_PILOT_AUTHORISATION_MISSING",
            severity: "warning",
            message:
              "The assigned pilot is not yet evidenced in the recorded OA personnel conditions for this mission.",
          });
        } else if (pilotAuthorisation.authorisationState === "pending_amendment") {
          reasons.push({
            code: "OA_PILOT_PENDING_AMENDMENT",
            severity: "warning",
            message:
              "The assigned pilot appears aligned with readiness requirements but remains pending OA amendment.",
          });
        } else if (
          pilotAuthorisation.authorisationState === "restricted" ||
          pilotAuthorisation.authorisationState === "inactive"
        ) {
          reasons.push({
            code: "OA_PILOT_RESTRICTED",
            severity: "fail",
            message:
              "The assigned pilot is currently restricted or inactive in the recorded OA personnel conditions.",
          });
        } else {
          if (
            pilotAuthorisation.allowedOperationTypes.length > 0 &&
            mission.operationType &&
            !pilotAuthorisation.allowedOperationTypes.includes(
              mission.operationType as any,
            )
          ) {
            reasons.push({
              code: "OA_PILOT_OPERATION_TYPE_NOT_AUTHORISED",
              severity: "fail",
              message:
                "The assigned pilot is not currently evidenced for this mission type in the recorded OA personnel conditions.",
            });
          }

          if (mission.requiresBvlos && !pilotAuthorisation.bvlosAuthorised) {
            reasons.push({
              code: "OA_PILOT_BVLOS_NOT_AUTHORISED",
              severity: "fail",
              message:
                "The assigned pilot is not currently evidenced for BVLOS in the recorded OA personnel conditions.",
            });
          }

          if (pilotAuthorisation.requiresAccountableReview) {
            reasons.push({
              code: "OA_PILOT_REQUIRES_ACCOUNTABLE_REVIEW",
              severity: "warning",
              message:
                "The assigned pilot requires accountable review under the recorded OA personnel conditions before continuation.",
            });
          }

          if (
            !reasons.some((reason) =>
              [
                "OA_PILOT_OPERATION_TYPE_NOT_AUTHORISED",
                "OA_PILOT_BVLOS_NOT_AUTHORISED",
                "OA_PILOT_REQUIRES_ACCOUNTABLE_REVIEW",
              ].includes(reason.code),
            )
          ) {
            reasons.push({
              code: "OA_PILOT_WITHIN_PERSONNEL_SCOPE",
              severity: "pass",
              message:
                "The assigned pilot is within the recorded OA personnel conditions.",
            });
          }
        }
      }

      if (!reasons.some((reason) => reason.severity === "fail")) {
        reasons.push({
          code: "OA_WITHIN_PROFILE",
          severity: "pass",
          message: "Mission is within the recorded active OA profile.",
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
        pilotAuthorisation,
      };
    } finally {
      client.release();
    }
  }
}
