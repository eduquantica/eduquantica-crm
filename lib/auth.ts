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
        try {
          const email = credentials?.email?.toLowerCase().trim();
          const password = credentials?.password;

          console.log("[AUTH] Login attempt:", { email, hasPassword: !!password });

          if (!email || !password) {
            console.log("[AUTH] Missing email or password");
            return null;
          }

          const user = await db.user.findUnique({
            where: { email },
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

          if (!user) {
            console.log("[AUTH] User not found:", { email });
            return null;
          }

          console.log("[AUTH] User found:", {
            email: user.email,
            userId: user.id,
            hasPassword: !!user.password,
            roleName: user.role?.name,
          });

          if (!user.password) {
            console.log("[AUTH] User has no password stored:", { userId: user.id, email });
            return null;
          }

          const passwordMatch = await bcrypt.compare(password, user.password);

          if (!passwordMatch) {
            console.log("[AUTH] Password mismatch:", {
              email,
              userId: user.id,
            });
            return null;
          }

          console.log("[AUTH] Authentication successful:", {
            email,
            userId: user.id,
            roleName: user.role?.name,
          });

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
        } catch (error) {
          console.error("[AUTH] Authorization error:", {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as Required<typeof user>;
        console.log("[JWT] Creating JWT token for user:", { userId: u.id, email: u.email });
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
      console.log("[SESSION] Creating session for user:", {
        userId: token.userId,
        email: session.user.email,
        roleName: token.roleName,
      });
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
