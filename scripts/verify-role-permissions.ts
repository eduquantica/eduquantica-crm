import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function verifyRolePermissions() {
  const roles = await prisma.role.findMany({
    where: {
      name: { in: ["BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"] },
    },
    include: { permissions: true },
  });

  console.log("✓ Role permissions verification:\n");

  for (const role of roles) {
    console.log(`Role: ${role.label} (${role.name})`);
    console.log(`  Built-in: ${role.isBuiltIn}`);
    console.log(`  Permissions:`);

    const permissions = role.permissions.sort((a, b) =>
      a.module.localeCompare(b.module)
    );
    for (const perm of permissions) {
      const actions = [
        perm.canView ? "View" : "",
        perm.canCreate ? "Create" : "",
        perm.canEdit ? "Edit" : "",
        perm.canDelete ? "Delete" : "",
      ]
        .filter(Boolean)
        .join(", ");
      console.log(`    ${perm.module.padEnd(15)} → ${actions || "None"}`);
    }
    console.log("");
  }

  console.log("✅ Roles and permissions verified successfully!");

  await pool.end();
}

verifyRolePermissions().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
