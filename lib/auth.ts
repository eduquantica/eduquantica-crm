import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import type { PermissionMap } from "@/types/next-auth";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: {
            role: {
              include: { permissions: true },
            },
            subAgent: {
              select: {
                isApproved: true,
                approvalStatus: true,
                rejectionReason: true,
              },
            },
          },
        });

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.password,
        );
        if (!passwordMatch) return null;

        // Build permissions map: module → { canView, canCreate, canEdit, canDelete }
        const permissions: PermissionMap = {};
        for (const perm of user.role.permissions) {
          permissions[perm.module] = {
            canView: perm.canView,
            canCreate: perm.canCreate,
            canEdit: perm.canEdit,
            canDelete: perm.canDelete,
          };
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleId: user.role.id,
          roleName: user.role.name,
          isBuiltIn: user.role.isBuiltIn,
          permissions,
          subAgentApproved: user.subAgent?.isApproved,
          subAgentApprovalStatus: user.subAgent
            ? String(user.subAgent.approvalStatus)
            : undefined,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present on initial sign-in; cast to extended User type
      if (user) {
        const u = user as Required<typeof user>;
        token.userId = u.id;
        token.roleId = u.roleId;
        token.roleName = u.roleName;
        token.isBuiltIn = u.isBuiltIn;
        token.permissions = u.permissions;
        token.subAgentApproved = u.subAgentApproved;
        token.subAgentApprovalStatus = u.subAgentApprovalStatus;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.roleId = token.roleId;
      session.user.roleName = token.roleName;
      session.user.isBuiltIn = token.isBuiltIn;
      session.user.permissions = token.permissions;
      session.user.subAgentApproved = token.subAgentApproved;
      session.user.subAgentApprovalStatus = token.subAgentApprovalStatus;
      return session;
    },
  },
};

// Re-export for server-side consumers that already import from lib/auth
export { getPortalPath } from "@/lib/portal";
