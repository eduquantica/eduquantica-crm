import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  const { db } = await import("../lib/db");
  const { ensureTestAccountsExist, TEST_ACCOUNTS, verifyTestAccountPasswords } = await import("../lib/test-accounts");

  console.log("🔎 Auth health check started\n");

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("❌ NEXTAUTH_SECRET is not set");
  } else {
    console.log("✅ NEXTAUTH_SECRET is set");
  }

  await db.$queryRaw`SELECT 1`;
  console.log("✅ Database connection is healthy");

  const existing = await db.user.findMany({
    where: { email: { in: TEST_ACCOUNTS.map((item) => item.email) } },
    select: { email: true, role: { select: { name: true } }, password: true },
  });

  const existingEmails = new Set(existing.map((item) => item.email));
  const missing = TEST_ACCOUNTS.filter((item) => !existingEmails.has(item.email));

  if (missing.length > 0) {
    console.log(`⚠️  Missing accounts detected: ${missing.map((item) => item.email).join(", ")}`);
    const recreated = await ensureTestAccountsExist();
    const recreatedList = recreated.filter((row) => row.recreated).map((row) => row.email);
    console.log(`✅ Recreated accounts: ${recreatedList.join(", ") || "none"}`);
  } else {
    console.log("✅ All test accounts are present");
  }

  const verification = await verifyTestAccountPasswords();

  console.log("\nAccount verification:");
  for (const row of verification) {
    const status = row.exists && row.roleMatch && row.passwordValid ? "✅" : "❌";
    console.log(
      `${status} ${row.email} | role=${row.role} | exists=${row.exists} | roleMatch=${row.roleMatch} | passwordValid=${row.passwordValid}`,
    );
  }

  const failing = verification.filter((row) => !row.exists || !row.roleMatch || !row.passwordValid);
  if (failing.length > 0) {
    console.error("\n❌ Auth health check failed");
    process.exitCode = 1;
    return;
  }

  if (!secret) {
    console.error("\n❌ Auth health check failed due to missing NEXTAUTH_SECRET");
    process.exitCode = 1;
    return;
  }

  console.log("\n✅ Auth health check passed");
}

main()
  .catch((error) => {
    console.error("❌ Auth health check crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { db } = await import("../lib/db");
    await db.$disconnect();
  });
