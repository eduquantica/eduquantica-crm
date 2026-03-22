import bcrypt from "bcryptjs";
import { db } from "./db";

export type TestAccountSeed = {
  roleName: "ADMIN" | "MANAGER" | "COUNSELLOR" | "SUB_AGENT" | "STUDENT";
  email: string;
  password: string;
  name: string;
  phone: string;
};

export const TEST_ACCOUNTS: TestAccountSeed[] = [
  {
    roleName: "ADMIN",
    email: "admin@eduquantica.com",
    password: "Admin123!",
    name: "EduQuantica Admin",
    phone: "+44 7000 000001",
  },
  {
    roleName: "MANAGER",
    email: "manager@eduquantica.com",
    password: "Manager123!",
    name: "EduQuantica Manager",
    phone: "+44 7000 000002",
  },
  {
    roleName: "COUNSELLOR",
    email: "counsellor@eduquantica.com",
    password: "Counsellor123!",
    name: "EduQuantica Counsellor",
    phone: "+44 7000 000003",
  },
  {
    roleName: "SUB_AGENT",
    email: "agent@eduquantica.com",
    password: "Agent123!",
    name: "EduQuantica Agent",
    phone: "+44 7000 000004",
  },
  {
    roleName: "STUDENT",
    email: "student@eduquantica.com",
    password: "Student123!",
    name: "EduQuantica Student",
    phone: "+44 7000 000005",
  },
];

export async function ensureTestAccountsExist() {
  const summary: Array<{ email: string; role: string; recreated: boolean }> = [];

  for (const entry of TEST_ACCOUNTS) {
    const role = await db.role.findUnique({ where: { name: entry.roleName }, select: { id: true } });
    if (!role) {
      throw new Error(`Missing required role ${entry.roleName}. Run seed to create baseline roles.`);
    }

    const existing = await db.user.findUnique({ where: { email: entry.email }, select: { id: true } });
    const password = await bcrypt.hash(entry.password, 12);

    await db.user.upsert({
      where: { email: entry.email },
      update: {
        name: entry.name,
        phone: entry.phone,
        password,
        roleId: role.id,
        isActive: true,
      },
      create: {
        email: entry.email,
        name: entry.name,
        phone: entry.phone,
        password,
        roleId: role.id,
        isActive: true,
      },
    });

    summary.push({ email: entry.email, role: entry.roleName, recreated: !existing });
  }

  return summary;
}

export async function verifyTestAccountPasswords() {
  const results: Array<{ email: string; role: string; exists: boolean; roleMatch: boolean; passwordValid: boolean }> = [];

  for (const account of TEST_ACCOUNTS) {
    const user = await db.user.findUnique({
      where: { email: account.email },
      select: {
        role: { select: { name: true } },
        password: true,
      },
    });

    if (!user) {
      results.push({
        email: account.email,
        role: account.roleName,
        exists: false,
        roleMatch: false,
        passwordValid: false,
      });
      continue;
    }

    const roleMatch = user.role.name === account.roleName;
    const passwordValid = user.password
      ? await bcrypt.compare(account.password, user.password)
      : false;

    results.push({
      email: account.email,
      role: account.roleName,
      exists: true,
      roleMatch,
      passwordValid,
    });
  }

  return results;
}
