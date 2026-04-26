import type { User } from "../users/users.types";

export interface LoginInput {
  email?: string;
  password?: string;
}

export interface AuthenticatedSession {
  sessionToken: string;
  user: User;
  expiresAt: string;
}
