export interface CreateUserInput {
  email?: string;
  displayName?: string;
  password?: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  status: "active" | "disabled";
  mfaState: "not_enabled" | "enabled";
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
