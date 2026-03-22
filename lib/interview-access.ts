import { Session } from "next-auth";
import { db } from "@/lib/db";

const EDITABLE_ROLES = new Set(["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "SUB_AGENT_STAFF", "STUDENT"]);

export type InterviewAccessContext = {
  actor: {
    id: string;
    name: string | null;
    email: string;
    roleName: string;
    subAgentStaffId?: string;
    subAgentId?: string;
  };
  application: {
    id: string;
    student: {
      id: string;
      userId: string;
      firstName: string;
      lastName: string;
      assignedCounsellorId: string | null;
      subAgentId: string | null;
      subAgent: {
        id: string;
        userId: string;
        agencyName: string;
        staffMembers: Array<{ userId: string; role: string; isActive: boolean }>;
      } | null;
    };
    university: { id: string; name: string };
    course: { id: string; name: string };
  };
};

function isAllowedRole(roleName: string, hasSubAgentStaff: boolean) {
  if (EDITABLE_ROLES.has(roleName)) return true;
  if (hasSubAgentStaff) return true;
  return false;
}

export async function getInterviewAccessContext(session: Session | null, applicationId: string): Promise<InterviewAccessContext | null> {
  if (!session?.user?.id) return null;

  const actor = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { name: true } },
      subAgentStaff: { select: { id: true, subAgentId: true, isActive: true } },
    },
  });

  if (!actor) return null;

  const roleName = actor.role?.name || session.user.roleName || "";
  const hasSubAgentStaff = !!actor.subAgentStaff?.id && actor.subAgentStaff.isActive;
  if (!isAllowedRole(roleName, hasSubAgentStaff)) return null;

  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      student: {
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          assignedCounsellorId: true,
          subAgentId: true,
          subAgent: {
            select: {
              id: true,
              userId: true,
              agencyName: true,
              staffMembers: {
                where: { isActive: true },
                select: { userId: true, role: true, isActive: true },
              },
            },
          },
        },
      },
      university: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
    },
  });

  if (!application) return null;

  const isAdmin = roleName === "ADMIN";
  const isManager = roleName === "MANAGER";
  const isCounsellor = roleName === "COUNSELLOR";
  const isStudent = roleName === "STUDENT";
  const isSubAgent = roleName === "SUB_AGENT" || hasSubAgentStaff;

  let canAccess = false;
  if (isAdmin || isManager) {
    canAccess = true;
  } else if (isCounsellor) {
    canAccess = application.student.assignedCounsellorId === actor.id;
  } else if (isStudent) {
    canAccess = application.student.userId === actor.id;
  } else if (isSubAgent) {
    const actorSubAgentId = actor.subAgentStaff?.subAgentId || session.user.subAgentId || null;
    canAccess = !!actorSubAgentId && application.student.subAgentId === actorSubAgentId;
    if (!canAccess && application.student.subAgent?.userId === actor.id) {
      canAccess = true;
    }
  }

  if (!canAccess) return null;

  return {
    actor: {
      id: actor.id,
      name: actor.name,
      email: actor.email,
      roleName,
      subAgentStaffId: actor.subAgentStaff?.id,
      subAgentId: actor.subAgentStaff?.subAgentId || session.user.subAgentId,
    },
    application,
  };
}

export function canActorRecordInterviewOutcome(ctx: InterviewAccessContext) {
  return ctx.actor.roleName !== "STUDENT";
}

export async function resolveUserNames(userIds: string[]) {
  if (!userIds.length) return new Map<string, string>();
  const rows = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) map.set(row.id, row.name || row.email);
  return map;
}
