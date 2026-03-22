import { TrainingRecordStatus } from "@prisma/client";
import { db } from "@/lib/db";

export const EDUQUANTICA_ORG_ID = "EDUQUANTICA";
export const EDUQUANTICA_ORG_TYPE = "EDUQUANTICA";

export function toSubAgentOrgType(subAgentId: string) {
  return `SUBAGENT_${subAgentId}`;
}

export function deriveTrainingStatus(expiryDate: Date | null, now = new Date()): TrainingRecordStatus {
  if (!expiryDate) return "ACTIVE";

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  if (expiry < today) return "EXPIRED";

  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  if (expiry <= in30) return "EXPIRING_SOON";

  return "ACTIVE";
}

export function normaliseTrainingStatus(status: string): TrainingRecordStatus | null {
  if (status === "ACTIVE" || status === "EXPIRING_SOON" || status === "EXPIRED" || status === "RENEWED") return status;
  return null;
}

export async function resolveOrganisationForUser(userId: string) {
  const [subAgentOwner, subAgentStaff] = await Promise.all([
    db.subAgent.findUnique({
      where: { userId },
      select: { id: true, agencyName: true, userId: true },
    }),
    db.subAgentStaff.findUnique({
      where: { userId },
      select: {
        id: true,
        role: true,
        subAgentId: true,
        subAgent: {
          select: {
            id: true,
            agencyName: true,
            userId: true,
          },
        },
      },
    }),
  ]);

  if (subAgentOwner) {
    return {
      organisationId: subAgentOwner.id,
      organisationType: toSubAgentOrgType(subAgentOwner.id),
      organisationLabel: subAgentOwner.agencyName,
      subAgentId: subAgentOwner.id,
      subAgentOwnerUserId: subAgentOwner.userId,
      isSubAgentOrganisation: true,
      isBranchCounsellor: false,
      isSubAgentManager: true,
    };
  }

  if (subAgentStaff?.subAgent) {
    const roleRaw = (subAgentStaff.role || "").toUpperCase();
    return {
      organisationId: subAgentStaff.subAgent.id,
      organisationType: toSubAgentOrgType(subAgentStaff.subAgent.id),
      organisationLabel: subAgentStaff.subAgent.agencyName,
      subAgentId: subAgentStaff.subAgent.id,
      subAgentOwnerUserId: subAgentStaff.subAgent.userId,
      isSubAgentOrganisation: true,
      isBranchCounsellor: roleRaw.includes("BRANCH_COUNSELLOR"),
      isSubAgentManager: roleRaw.includes("MANAGER"),
    };
  }

  return {
    organisationId: EDUQUANTICA_ORG_ID,
    organisationType: EDUQUANTICA_ORG_TYPE,
    organisationLabel: "EduQuantica",
    subAgentId: null,
    subAgentOwnerUserId: null,
    isSubAgentOrganisation: false,
    isBranchCounsellor: false,
    isSubAgentManager: false,
  };
}

export async function isEduquanticaStaffUser(userId: string) {
  const [user, subAgent, subAgentStaff] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: { select: { name: true } },
      },
    }),
    db.subAgent.findUnique({ where: { userId }, select: { id: true } }),
    db.subAgentStaff.findUnique({ where: { userId }, select: { id: true } }),
  ]);

  if (!user) return false;
  if (subAgent || subAgentStaff) return false;

  return user.role.name !== "STUDENT";
}

export async function getEduquanticaStaffOptions() {
  const users = await db.user.findMany({
    where: {
      role: { name: { notIn: ["STUDENT", "SUB_AGENT"] } },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { name: true, label: true } },
      subAgent: { select: { id: true } },
      subAgentStaff: { select: { id: true } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return users
    .filter((item) => !item.subAgent && !item.subAgentStaff)
    .map((item) => ({
      id: item.id,
      name: item.name || item.email,
      email: item.email,
      roleName: item.role.name,
      roleLabel: item.role.label,
    }));
}

export async function getSubAgentStaffOptions(subAgentId: string) {
  const [owner, staff] = await Promise.all([
    db.subAgent.findUnique({
      where: { id: subAgentId },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    db.subAgentStaff.findMany({
      where: {
        subAgentId,
        isActive: true,
      },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const options = [] as Array<{ id: string; name: string; email: string; roleName: string; roleLabel: string }>;

  if (owner?.user) {
    options.push({
      id: owner.user.id,
      name: owner.user.name || owner.user.email,
      email: owner.user.email,
      roleName: "SUB_AGENT_MANAGER",
      roleLabel: "Sub-Agent Owner",
    });
  }

  for (const item of staff) {
    options.push({
      id: item.userId,
      name: item.name,
      email: item.email,
      roleName: item.role,
      roleLabel: item.role.replace(/_/g, " "),
    });
  }

  return options;
}

export function trainingRecordStatusColor(status: TrainingRecordStatus) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "EXPIRING_SOON") return "bg-amber-100 text-amber-700";
  if (status === "EXPIRED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}
