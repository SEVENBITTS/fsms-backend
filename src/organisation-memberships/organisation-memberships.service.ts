import type { Pool } from "pg";
import { OrganisationMembershipForbiddenError } from "./organisation-memberships.errors";
import { OrganisationMembershipsRepository } from "./organisation-memberships.repository";
import type {
  CreateOrganisationMembershipInput,
  OrganisationMembership,
  OrganisationRole,
} from "./organisation-memberships.types";
import { validateCreateOrganisationMembershipInput } from "./organisation-memberships.validators";

export class OrganisationMembershipsService {
  constructor(
    private readonly pool: Pool,
    private readonly organisationMembershipsRepository: OrganisationMembershipsRepository,
  ) {}

  async createMembership(
    organisationId: string,
    input: CreateOrganisationMembershipInput | undefined,
  ) {
    const validated = validateCreateOrganisationMembershipInput(input);
    const client = await this.pool.connect();

    try {
      const membership =
        await this.organisationMembershipsRepository.upsertMembership(client, {
          organisationId,
          userId: validated.userId,
          role: validated.role,
        });

      return { membership };
    } finally {
      client.release();
    }
  }

  async requireMembership(
    userId: string,
    organisationId: string,
    allowedRoles: OrganisationRole[],
  ): Promise<OrganisationMembership> {
    const client = await this.pool.connect();

    try {
      const membership =
        await this.organisationMembershipsRepository.getMembershipForUserAndOrganisation(
          client,
          userId,
          organisationId,
        );

      if (!membership) {
        throw new OrganisationMembershipForbiddenError(
          "User does not have active membership for this organisation.",
        );
      }

      if (!allowedRoles.includes(membership.role)) {
        throw new OrganisationMembershipForbiddenError(
          `Role ${membership.role} is not currently permitted for this action.`,
        );
      }

      return membership;
    } finally {
      client.release();
    }
  }
}
