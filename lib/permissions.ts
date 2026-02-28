/**
 * Permission helpers for EduQuantica RBAC.
 *
 * Server-side: checkPermission(session, module, action)
 * Client-side: usePermission(module, action) — React hook
 *
 * All API routes must call checkPermission and return 403 on failure.
 * ADMIN role bypasses all permission checks.
 */

import type { Session } from "next-auth";
import { useSession } from "next-auth/react";

export type PermissionAction = "canView" | "canCreate" | "canEdit" | "canDelete";

// ─── Server-side helper ───────────────────────────────────────────────────────

/**
 * Returns true if the session user has the given permission.
 * ADMIN always returns true regardless of stored permissions.
 *
 * Usage in API route:
 *   const session = await getServerSession(authOptions);
 *   if (!checkPermission(session, "leads", "canCreate")) {
 *     return NextResponse.json({ error: "You do not have permission to perform this action" }, { status: 403 });
 *   }
 */
export function checkPermission(
  session: Session | null,
  module: string,
  action: PermissionAction,
): boolean {
  if (!session?.user) return false;

  // ADMIN has unrestricted access to everything
  if (session.user.roleName === "ADMIN") return true;

  return session.user.permissions?.[module]?.[action] === true;
}

// ─── Client-side hooks ────────────────────────────────────────────────────────

/**
 * React hook — reads permissions from the NextAuth session client-side.
 *
 * Usage in a component:
 *   const canCreate = usePermission("leads", "canCreate");
 *   if (!canCreate) return null;
 */
export function usePermission(module: string, action: PermissionAction): boolean {
  const { data: session } = useSession();

  if (!session?.user) return false;
  if (session.user.roleName === "ADMIN") return true;

  return session.user.permissions?.[module]?.[action] === true;
}

/**
 * Hook variant that returns the full permission object for a module.
 *
 * Usage:
 *   const perms = useModulePermissions("students");
 *   perms.canView, perms.canCreate, perms.canEdit, perms.canDelete
 */
export function useModulePermissions(module: string) {
  const { data: session } = useSession();

  const isAdmin = session?.user?.roleName === "ADMIN";

  return {
    canView: isAdmin || session?.user?.permissions?.[module]?.canView === true,
    canCreate: isAdmin || session?.user?.permissions?.[module]?.canCreate === true,
    canEdit: isAdmin || session?.user?.permissions?.[module]?.canEdit === true,
    canDelete: isAdmin || session?.user?.permissions?.[module]?.canDelete === true,
  };
}
