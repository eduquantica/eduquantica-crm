import { Session } from "next-auth";
import { db } from "@/lib/db";

export type MockInterviewAccessContext = {
  actor: {
    id: string;
    roleName: string;
    subAgentId: string | null;
    subAgentStaffId: string | null;
    isBranchCounsellor: boolean;
  };
  student: {
    id: string;
    userId: string;
    assignedCounsellorId: string | null;
    subAgentId: string | null;
    subAgentStaffId: string | null;
  };
  application: {
    id: string;
    studentId: string;
    universityName: string;
    universityCountry: string;
    courseName: string;
  };
};

export async function getMockInterviewAccessContextByApplication(
  session: Session | null,
  applicationId: string,
): Promise<MockInterviewAccessContext | null> {
  if (!session?.user?.id) return null;

  const [actor, application] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: { select: { name: true } },
        subAgent: { select: { id: true } },
        subAgentStaff: { select: { id: true, subAgentId: true, role: true, isActive: true } },
      },
    }),
    db.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        studentId: true,
        student: {
          select: {
            id: true,
            userId: true,
            assignedCounsellorId: true,
            subAgentId: true,
            subAgentStaffId: true,
          },
        },
        course: {
          select: {
            name: true,
            university: { select: { name: true, country: true } },
          },
        },
      },
    }),
  ]);

  if (!actor || !application?.student) return null;

  const roleName = actor.role.name;
  const actorSubAgentId = actor.subAgent?.id || actor.subAgentStaff?.subAgentId || null;
  const isBranchCounsellor = Boolean(actor.subAgentStaff?.isActive && actor.subAgentStaff.role === "BRANCH_COUNSELLOR");

  const isAdmin = roleName === "ADMIN" || roleName === "MANAGER";
  const isCounsellor = roleName === "COUNSELLOR";
  const isStudent = roleName === "STUDENT";
  const isSubAgent = roleName === "SUB_AGENT" || Boolean(actor.subAgentStaff?.id);

  const canAccess =
    isAdmin ||
    (isCounsellor && application.student.assignedCounsellorId === actor.id) ||
    (isStudent && application.student.userId === actor.id) ||
    (isSubAgent && !!actorSubAgentId && application.student.subAgentId === actorSubAgentId);

  if (!canAccess) return null;

  return {
    actor: {
      id: actor.id,
      roleName,
      subAgentId: actorSubAgentId,
      subAgentStaffId: actor.subAgentStaff?.id || null,
      isBranchCounsellor,
    },
    student: {
      id: application.student.id,
      userId: application.student.userId,
      assignedCounsellorId: application.student.assignedCounsellorId,
      subAgentId: application.student.subAgentId,
      subAgentStaffId: application.student.subAgentStaffId,
    },
    application: {
      id: application.id,
      studentId: application.studentId,
      universityName: application.course.university.name,
      universityCountry: application.course.university.country,
      courseName: application.course.name,
    },
  };
}

export async function getMockInterviewAccessContextByInterview(
  session: Session | null,
  interviewId: string,
): Promise<(MockInterviewAccessContext & { interview: { id: string; status: string; assignedById: string } }) | null> {
  if (!session?.user?.id) return null;

  const interview = await db.mockInterview.findUnique({
    where: { id: interviewId },
    select: {
      id: true,
      status: true,
      assignedById: true,
      applicationId: true,
    },
  });

  if (!interview) return null;

  const ctx = await getMockInterviewAccessContextByApplication(session, interview.applicationId);
  if (!ctx) return null;

  return {
    ...ctx,
    interview: {
      id: interview.id,
      status: interview.status,
      assignedById: interview.assignedById,
    },
  };
}
