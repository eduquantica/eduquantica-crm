import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "@/lib/db";

async function main() {
  const admin = await db.user.findUnique({ where: { email: "admin@eduquantica.com" } });
  const studentUser = await db.user.findUnique({ where: { email: "student@eduquantica.com" } });
  const counsellor = await db.user.findUnique({ where: { email: "counsellor@eduquantica.com" } });
  const agentUser = await db.user.findUnique({ where: { email: "agent@eduquantica.com" } });

  if (!admin || !studentUser || !counsellor || !agentUser) {
    throw new Error("Required seeded users are missing. Run npx prisma db seed first.");
  }

  let subAgent = await db.subAgent.findUnique({ where: { userId: agentUser.id } });
  if (!subAgent) {
    subAgent = await db.subAgent.create({
      data: {
        userId: agentUser.id,
        agencyName: "EduQuantica QA Agency",
        firstName: "QA",
        lastName: "Agent",
        roleAtAgency: "Manager",
        businessEmail: "agent@eduquantica.com",
        primaryDialCode: "+44",
        phone: "+447000000004",
        agencyCountry: "UK",
        agencyCity: "London",
        approvalStatus: "APPROVED",
        isApproved: true,
        commissionRate: 80,
      },
    });
  } else if (!subAgent.isApproved || subAgent.approvalStatus !== "APPROVED") {
    subAgent = await db.subAgent.update({
      where: { id: subAgent.id },
      data: { isApproved: true, approvalStatus: "APPROVED" },
    });
  }

  let student = await db.student.findUnique({ where: { userId: studentUser.id } });
  if (!student) {
    student = await db.student.create({
      data: {
        userId: studentUser.id,
        firstName: "EduQuantica",
        lastName: "Student",
        email: "student@eduquantica.com",
        assignedCounsellorId: counsellor.id,
        subAgentId: subAgent.id,
      },
    });
  } else {
    student = await db.student.update({
      where: { id: student.id },
      data: {
        assignedCounsellorId: counsellor.id,
        subAgentId: subAgent.id,
      },
    });
  }

  console.log(JSON.stringify({ studentId: student.id }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
