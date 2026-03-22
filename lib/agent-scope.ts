import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export type AgentScope = {
  userId: string;
  roleName: string;
  subAgentId: string;
  subAgentUserId: string;
  subAgentStaffId: string | null;
  isBranchCounsellor: boolean;
};

export async function getAgentScope(): Promise<AgentScope | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"].includes(session.user.roleName)) return null;

  if (session.user.isBranchCounsellor && session.user.subAgentId) {
    return {
      userId: session.user.id,
      roleName: session.user.roleName,
      subAgentId: session.user.subAgentId,
      subAgentUserId: session.user.id,
      subAgentStaffId: session.user.subAgentStaffId || null,
      isBranchCounsellor: true,
    };
  }

  if (session.user.roleName === "BRANCH_MANAGER" || session.user.roleName === "SUB_AGENT_COUNSELLOR") {
    const staff = await db.subAgentStaff.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        subAgentId: true,
        role: true,
        subAgent: { select: { userId: true } },
      },
    });

    if (!staff) return null;

    return {
      userId: session.user.id,
      roleName: session.user.roleName,
      subAgentId: staff.subAgentId,
      subAgentUserId: staff.subAgent.userId,
      subAgentStaffId: staff.id,
      isBranchCounsellor: session.user.roleName === "SUB_AGENT_COUNSELLOR" || staff.role.toUpperCase().includes("COUNSELLOR"),
    };
  }

  const subAgent = await db.subAgent.findUnique({
    where: { userId: session.user.id },
    select: { id: true, userId: true },
  });

  if (!subAgent) return null;

  return {
    userId: session.user.id,
    roleName: session.user.roleName,
    subAgentId: subAgent.id,
    subAgentUserId: subAgent.userId,
    subAgentStaffId: null,
    isBranchCounsellor: false,
  };
}

export function getAgentStudentWhere(scope: AgentScope) {
  if (scope.isBranchCounsellor && scope.subAgentStaffId) {
    return {
      subAgentId: scope.subAgentId,
      subAgentStaffId: scope.subAgentStaffId,
    };
  }

  return { subAgentId: scope.subAgentId };
}

export async function canAccessStudent(scope: AgentScope, studentId: string) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, subAgentId: true, subAgentStaffId: true },
  });

  if (!student || student.subAgentId !== scope.subAgentId) return false;
  if (scope.isBranchCounsellor && scope.subAgentStaffId) {
    return student.subAgentStaffId === scope.subAgentStaffId;
  }

  return true;
}
