import { randomUUID } from "crypto";
import type { PoolClient, QueryResultRow } from "pg";
import type { OrganisationMembership } from "./organisation-memberships.types";

interface MembershipRow extends QueryResultRow {
  id: string;
  organisation_id: string;
  user_id: string;
  role: OrganisationMembership["role"];
  status: OrganisationMembership["status"];
  created_at: Date;
  updated_at: Date;
}

const toMembership = (row: MembershipRow): OrganisationMembership => ({
  id: row.id,
  organisationId: row.organisation_id,
  userId: row.user_id,
  role: row.role,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class OrganisationMembershipsRepository {
  async upsertMembership(
    tx: PoolClient,
    params: { organisationId: string; userId: string; role: OrganisationMembership["role"] },
  ): Promise<OrganisationMembership> {
    const result = await tx.query<MembershipRow>(
      `
      insert into organisation_memberships (
        id,
        organisation_id,
        user_id,
        role,
        status
      )
      values ($1, $2, $3, $4, 'active')
      on conflict (organisation_id, user_id)
      do update set
        role = excluded.role,
        status = 'active',
        updated_at = now()
      returning *
      `,
      [randomUUID(), params.organisationId, params.userId, params.role],
    );

    return toMembership(result.rows[0]);
  }

  async getMembershipForUserAndOrganisation(
    tx: PoolClient,
    userId: string,
    organisationId: string,
  ): Promise<OrganisationMembership | null> {
    const result = await tx.query<MembershipRow>(
      `
      select *
      from organisation_memberships
      where user_id = $1
        and organisation_id = $2
        and status = 'active'
      `,
      [userId, organisationId],
    );

    return result.rows[0] ? toMembership(result.rows[0]) : null;
  }
}
