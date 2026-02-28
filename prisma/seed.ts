// Load env vars before PrismaClient is instantiated
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Module definitions ───────────────────────────────────────────────────────

const MODULES = [
  "leads",
  "students",
  "applications",
  "universities",
  "courses",
  "sub-agents",
  "communications",
  "tasks",
  "commissions",
  "visa",
  "documents",
  "reports",
  "settings",
] as const;

type Module = (typeof MODULES)[number];

interface PermissionDef {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// ─── Permission presets ───────────────────────────────────────────────────────

const FULL: PermissionDef = { canView: true, canCreate: true, canEdit: true, canDelete: true };
const VIEW_EDIT: PermissionDef = { canView: true, canCreate: false, canEdit: true, canDelete: false };
const VIEW_CREATE_EDIT: PermissionDef = { canView: true, canCreate: true, canEdit: true, canDelete: false };
const VIEW_ONLY: PermissionDef = { canView: true, canCreate: false, canEdit: false, canDelete: false };
const NONE: PermissionDef = { canView: false, canCreate: false, canEdit: false, canDelete: false };

const allModules = (perm: PermissionDef): Record<Module, PermissionDef> =>
  Object.fromEntries(MODULES.map((m) => [m, perm])) as Record<Module, PermissionDef>;

// ─── Role seed definitions ────────────────────────────────────────────────────

interface RoleSeed {
  name: string;
  label: string;
  permissions: Record<Module, PermissionDef>;
}

const ROLES: RoleSeed[] = [
  {
    name: "ADMIN",
    label: "Admin",
    permissions: allModules(FULL),
  },
  {
    name: "MANAGER",
    label: "Manager",
    permissions: {
      leads:          VIEW_EDIT,
      students:       VIEW_EDIT,
      applications:   VIEW_EDIT,
      universities:   VIEW_EDIT,
      courses:        VIEW_EDIT,
      "sub-agents":   VIEW_EDIT,
      communications: VIEW_EDIT,
      tasks:          VIEW_EDIT,
      commissions:    VIEW_EDIT,
      visa:           VIEW_EDIT,
      documents:      VIEW_EDIT,
      reports:        VIEW_EDIT,
      settings:       NONE,       // managers have no access to settings
    },
  },
  {
    name: "COUNSELLOR",
    label: "Counsellor",
    permissions: {
      leads:          VIEW_CREATE_EDIT,
      students:       VIEW_CREATE_EDIT,
      applications:   VIEW_CREATE_EDIT,
      universities:   VIEW_ONLY,
      courses:        VIEW_ONLY,
      "sub-agents":   NONE,
      communications: VIEW_CREATE_EDIT,
      tasks:          VIEW_CREATE_EDIT,
      commissions:    NONE,
      visa:           VIEW_CREATE_EDIT,
      documents:      VIEW_CREATE_EDIT,
      reports:        NONE,
      settings:       NONE,
    },
  },
  {
    // Student portal is separate — no dashboard module access
    name: "STUDENT",
    label: "Student",
    permissions: allModules(NONE),
  },
  {
    // Agent portal is separate — no dashboard module access
    name: "SUB_AGENT",
    label: "Sub-Agent",
    permissions: allModules(NONE),
  },
];

// ─── Seed logic ───────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding RBAC roles and permissions…\n");

  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { label: roleDef.label, isBuiltIn: true },
      create: { name: roleDef.name, label: roleDef.label, isBuiltIn: true },
    });

    for (const module of MODULES) {
      const perm = roleDef.permissions[module];
      await prisma.permission.upsert({
        where: { roleId_module: { roleId: role.id, module } },
        update: perm,
        create: { roleId: role.id, module, ...perm },
      });
    }

    const granted = MODULES.filter((m) => roleDef.permissions[m].canView);
    console.log(`  ✓ ${roleDef.label.padEnd(12)} — view access on: ${granted.join(", ") || "none (portal role)"}`);
  }

  console.log("\nSeeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
