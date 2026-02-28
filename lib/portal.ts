/**
 * Pure, client-safe portal routing helpers.
 * No Node.js / Prisma imports — safe to use in Client Components.
 */

/**
 * Returns the home URL for a given role.
 * Used after login and in middleware redirects.
 */
export function getPortalPath(
  roleName: string,
  subAgentApproved?: boolean,
): string {
  if (roleName === "STUDENT") return "/student";
  if (roleName === "SUB_AGENT") {
    return subAgentApproved ? "/agent" : "/agent/pending";
  }
  // ADMIN, COUNSELLOR, MANAGER, or any custom staff role → dashboard
  return "/dashboard";
}
