import { db } from "@/lib/db";

// Generates a unique 10-digit student number (1000000000 – 9999999999)
export async function generateStudentNumber(): Promise<number> {
  const min = 1_000_000_000;
  const max = 9_999_999_999;
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
