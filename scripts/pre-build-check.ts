import { config } from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const ROOT = process.cwd();

async function fileExists(relativePath: string) {
  try {
    await fs.access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("🔎 Running pre-build validation\n");

  const requiredEnv = ["DATABASE_URL", "NEXTAUTH_SECRET"];
  const missingEnv = requiredEnv.filter((name) => !process.env[name]);
  if (missingEnv.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  }
  console.log(`✅ Environment variables present: ${requiredEnv.join(", ")}`);

  const migrateStatusOutput = execSync("npx prisma migrate status", {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });

  if (!/up to date|Database schema is up to date|No migration found in prisma\/migrations/i.test(migrateStatusOutput)) {
    throw new Error("Prisma migration status is not healthy. Run migrations before building.");
  }
  console.log("✅ Prisma migration status is healthy");

  execSync("npx tsx scripts/check-layouts.ts", {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  console.log("✅ Layout integrity is healthy");

  const requiredRoutes = [
    "app/dashboard/page.tsx",
    "app/agent/(portal)/dashboard/page.tsx",
    "app/student/dashboard/page.tsx",
    "app/dashboard/layout.tsx",
    "app/agent/layout.tsx",
    "app/student/layout.tsx",
  ];

  const missingRoutes: string[] = [];
  for (const route of requiredRoutes) {
    if (!(await fileExists(route))) {
      missingRoutes.push(route);
    }
  }

  if (missingRoutes.length > 0) {
    throw new Error(`Missing required routes/layouts:\n${missingRoutes.join("\n")}`);
  }
  console.log("✅ Required portal routes/layouts exist");

  console.log("\n✅ Pre-build validation passed");
}

main().catch((error) => {
  console.error("❌ Pre-build validation failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
