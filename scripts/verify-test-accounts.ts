import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function verifyAccounts() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          "branchmanager@eduquantica.com",
          "agentcounsellor@eduquantica.com",
        ],
      },
    },
    include: { role: true },
  });

  console.log("✓ Account verification results:\n");
  for (const user of users) {
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role.label} (${user.role.name})`);
    console.log(`  Active: ${user.isActive}`);
    console.log(`  Created: ${user.createdAt}`);
    console.log("");
  }

  if (users.length === 2) {
    console.log("✅ Both test accounts created successfully!");
  } else {
    console.log(`⚠️  Expected 2 accounts, found ${users.length}`);
  }

  await pool.end();
}

verifyAccounts().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
