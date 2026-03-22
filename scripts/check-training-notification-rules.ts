import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TrainingRecordStatus } from "@prisma/client";
import { sendTrainingExpiryNotifications } from "@/lib/training-notifications";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const PASSWORD = process.env.QA_PASSWORD || "Pass1234!";

function tag() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

async function ensureRole(name: string) {
  const role = await prisma.role.findFirst({ where: { name }, select: { id: true } });
  if (!role) throw new Error(`Missing role ${name}`);
  return role.id;
}

async function upsertUser(email: string, name: string, roleName: string) {
  const password = await bcrypt.hash(PASSWORD, 10);
  const roleId = await ensureRole(roleName);
  return prisma.user.upsert({
    where: { email },
    update: { name, roleId, password, isActive: true },
    create: { email, name, roleId, password, isActive: true },
    select: { id: true, email: true },
  });
}

async function ensureSubAgent(userId: string, agencyName: string) {
  const existing = await prisma.subAgent.findUnique({ where: { userId }, select: { id: true } });
  if (existing) {
    return prisma.subAgent.update({ where: { id: existing.id }, data: { agencyName, isApproved: true, approvalStatus: "APPROVED" }, select: { id: true } });
  }
  return prisma.subAgent.create({
    data: { userId, agencyName, isApproved: true, approvalStatus: "APPROVED", commissionRate: 80 },
    select: { id: true },
  });
}

async function ensureSubAgentStaff(subAgentId: string, userId: string, email: string, name: string, role: string) {
  const existing = await prisma.subAgentStaff.findUnique({ where: { userId }, select: { id: true } });
  if (existing) {
    return prisma.subAgentStaff.update({ where: { id: existing.id }, data: { subAgentId, role, email, name, isActive: true }, select: { id: true } });
  }
  return prisma.subAgentStaff.create({
    data: { subAgentId, userId, role, email, name, isActive: true },
    select: { id: true },
  });
}

async function createRecord(params: {
  userId: string;
  orgId: string;
  orgType: string;
  name: string;
  status: TrainingRecordStatus;
}) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 1);

  const training = await prisma.training.create({
    data: {
      organisationId: params.orgId,
      organisationType: params.orgType,
      name: params.name,
      deliveredBy: "QA",
      createdBy: params.userId,
      expiryDate,
    },
  });

  return prisma.trainingRecord.create({
    data: {
      trainingId: training.id,
      userId: params.userId,
      completionDate: new Date(),
      expiryDate,
      status: params.status,
    },
  });
}

async function usersByEmails(emails: string[]) {
  return prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
}

async function notificationRecipientsFor(messageContains: string) {
  const rows = await prisma.notification.findMany({
    where: { type: "TRAINING_RENEWAL_REQUIRED", message: { contains: messageContains } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

function expectContains(set: Set<string>, ids: string[], label: string) {
  for (const id of ids) {
    if (!set.has(id)) throw new Error(`${label}: missing expected recipient ${id}`);
  }
}

async function run() {
  const t = tag();

  const admin = await upsertUser(`qa.nr.admin.${t}@example.com`, "QA NR Admin", "ADMIN");
  const manager = await upsertUser(`qa.nr.manager.${t}@example.com`, "QA NR Manager", "MANAGER");
  const counsellor = await upsertUser(`qa.nr.counsellor.${t}@example.com`, "QA NR Counsellor", "COUNSELLOR");

  const subOwner = await upsertUser(`qa.nr.subowner.${t}@example.com`, "QA NR SubOwner", "SUB_AGENT");
  const subManager = await upsertUser(`qa.nr.submanager.${t}@example.com`, "QA NR SubManager", "SUB_AGENT");
  const branch = await upsertUser(`qa.nr.branch.${t}@example.com`, "QA NR Branch", "SUB_AGENT");

  const sub = await ensureSubAgent(subOwner.id, `QA NR Agency ${t}`);
  await ensureSubAgentStaff(sub.id, subManager.id, subManager.email, "QA NR SubManager", "MANAGER");
  await ensureSubAgentStaff(sub.id, branch.id, branch.email, "QA NR Branch", "BRANCH_COUNSELLOR");

  await prisma.notification.deleteMany({ where: { userId: { in: [admin.id, manager.id, counsellor.id, subOwner.id, subManager.id, branch.id] } } });

  const eduCounsellorRecord = await createRecord({ userId: counsellor.id, orgId: "EDUQUANTICA", orgType: "EDUQUANTICA", name: `NR-EDU-C-${t}`, status: "EXPIRING_SOON" });
  await sendTrainingExpiryNotifications(eduCounsellorRecord.id, "THIRTY_DAYS");
  const eduCounsellorRecipients = await notificationRecipientsFor(`NR-EDU-C-${t}`);
  expectContains(eduCounsellorRecipients, [counsellor.id, manager.id, admin.id], "Edu counsellor");

  const eduManagerRecord = await createRecord({ userId: manager.id, orgId: "EDUQUANTICA", orgType: "EDUQUANTICA", name: `NR-EDU-M-${t}`, status: "EXPIRING_SOON" });
  await sendTrainingExpiryNotifications(eduManagerRecord.id, "THIRTY_DAYS");
  const eduManagerRecipients = await notificationRecipientsFor(`NR-EDU-M-${t}`);
  expectContains(eduManagerRecipients, [manager.id, admin.id], "Edu manager");

  const subBranchRecord = await createRecord({ userId: branch.id, orgId: sub.id, orgType: `SUBAGENT_${sub.id}`, name: `NR-SA-B-${t}`, status: "EXPIRING_SOON" });
  await sendTrainingExpiryNotifications(subBranchRecord.id, "THIRTY_DAYS");
  const subBranchRecipients = await notificationRecipientsFor(`NR-SA-B-${t}`);
  expectContains(subBranchRecipients, [branch.id, subOwner.id], "Sub-agent branch counsellor");

  const subManagerRecord = await createRecord({ userId: subManager.id, orgId: sub.id, orgType: `SUBAGENT_${sub.id}`, name: `NR-SA-M-${t}`, status: "EXPIRING_SOON" });
  await sendTrainingExpiryNotifications(subManagerRecord.id, "THIRTY_DAYS");
  const subManagerRecipients = await notificationRecipientsFor(`NR-SA-M-${t}`);
  expectContains(subManagerRecipients, [subManager.id, subOwner.id], "Sub-agent manager");

  console.log("✅ Notification rules validated");
}

run()
  .catch((error) => {
    console.error("❌ Notification rule check failed:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
  });
