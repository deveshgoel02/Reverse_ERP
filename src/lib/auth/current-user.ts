import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";
import type { UserRole } from "@/lib/enums";

export interface CurrentUser {
  id: string;
  businessId: string;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Resolves the logged-in user for the current request. Re-checks `active`
 * in the DB rather than trusting the session token's claims alone, so a
 * deactivated account is locked out immediately without waiting for token
 * expiry.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active || user.businessId !== session.businessId) return null;

  return {
    id: user.id,
    businessId: user.businessId,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Not authenticated");
  return user;
}

export class AuthError extends Error {}

const ROLE_RANK: Record<UserRole, number> = { VIEWER: 0, STAFF: 1, MANAGER: 2, OWNER: 3 };

export function requireRole(user: CurrentUser, minRole: UserRole) {
  if (ROLE_RANK[user.role] < ROLE_RANK[minRole]) {
    throw new AuthError(`Requires role ${minRole} or above`);
  }
}
