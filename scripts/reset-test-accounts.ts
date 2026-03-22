import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  const { db } = await import("../lib/db");
  const { ensureTestAccountsExist, TEST_ACCOUNTS, verifyTestAccountPasswords } = await import("../lib/test-accounts");
  const TEST_EMAILS = TEST_ACCOUNTS.map((account) => account.email);

  console.log("\n📋 Existing test accounts before reset:");
  const before = await db.user.findMany({
    where: { email: { in: TEST_EMAILS } },
    select: { email: true, role: { select: { name: true } } },
    orderBy: { email: "asc" },
  });

  if (before.length === 0) {
    console.log("(none found)");
  } else {
    for (const user of before) {
      console.log(`- ${user.email} | role=${user.role.name}`);
    }
  }

  const usersToDelete = await db.user.findMany({
    where: { email: { in: TEST_EMAILS } },
    select: { id: true },
  });
  const userIds = usersToDelete.map((item) => item.id);

  if (userIds.length > 0) {
    await db.subAgent.deleteMany({ where: { userId: { in: userIds } } });
    await db.student.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }

  console.log("\n🧹 Deleted existing test accounts.");

  await ensureTestAccountsExist();
  console.log("✅ Recreated fresh test accounts with bcrypt cost 12 hashes.");

  const verification = await verifyTestAccountPasswords();
  console.log("\n🔐 Direct bcrypt.compare verification:");
  for (const row of verification) {
    const ok = row.exists && row.roleMatch && row.passwordValid;
    console.log(
      `${ok ? "✅" : "❌"} ${row.email} | role=${row.role} | exists=${row.exists} | roleMatch=${row.roleMatch} | passwordValid=${row.passwordValid}`,
    );
  }

  const failing = verification.filter((row) => !row.exists || !row.roleMatch || !row.passwordValid);
  if (failing.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { db } = await import("../lib/db");
    await db.$disconnect();
  });
