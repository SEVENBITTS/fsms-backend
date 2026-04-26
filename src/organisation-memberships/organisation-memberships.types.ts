export type OrganisationRole =
  | "viewer"
  | "operator"
  | "operations_manager"
  | "compliance_manager"
  | "accountable_manager"
  | "admin";

export interface CreateOrganisationMembershipInput {
  userId?: string;
  role?: OrganisationRole;
}

export interface OrganisationMembership {
  id: string;
  organisationId: string;
  userId: string;
  role: OrganisationRole;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
}
