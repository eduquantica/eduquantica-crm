import { db } from "@/lib/db";

// Prisma Int maps to a 32-bit signed integer, so keep values <= 2147483647.
// We use 9 digits to stay safely in range while keeping IDs human-friendly.
export async function generateStudentNumber(): Promise<number> {
  const min = 100_000_000;
  const max = 999_999_999;
  for (let attempt = 0; attempt < 20; attempt++) {
    const n = Math.floor(Math.random() * (max - min + 1)) + min;
    const exists = await db.student.findUnique({ where: { studentNumber: n }, select: { id: true } });
    if (!exists) return n;
  }
  throw new Error("Could not generate unique student number after 20 attempts");
}

// Generates a unique application reference like APP-0012345
export async function generateApplicationRef(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const n = Math.floor(Math.random() * 9_000_000) + 1_000_000; // 7 digits
    const ref = `APP-${n}`;
    const exists = await db.application.findUnique({ where: { applicationRef: ref }, select: { id: true } });
    if (!exists) return ref;
  }
  throw new Error("Could not generate unique application ref after 20 attempts");
}
