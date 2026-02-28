import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

export type PermissionMap = Record<
  string,
  { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }
>;

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roleId: string;
      roleName: string;
      isBuiltIn: boolean;
      permissions: PermissionMap;
      subAgentApproved?: boolean;
      subAgentApprovalStatus?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    roleId: string;
    roleName: string;
    isBuiltIn: boolean;
    permissions: PermissionMap;
    subAgentApproved?: boolean;
    subAgentApprovalStatus?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    userId: string;
    roleId: string;
    roleName: string;
    isBuiltIn: boolean;
    permissions: PermissionMap;
    subAgentApproved?: boolean;
    subAgentApprovalStatus?: string;
  }
}
