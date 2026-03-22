import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  const { db } = await import("../lib/db");
  const users = await db.user.findMany({
    select: {
      email: true,
      name: true,
      isActive: true,
      role: { select: { name: true } },
    },
    orderBy: { email: "asc" },
  });

  console.log("Current users and roles:");
  for (const user of users) {
    console.log(
      `${user.email} | role=${user.role.name} | active=${user.isActive} | name=${user.name ?? "-"}`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    const { db } = await import("../lib/db");
    await db.$disconnect();
  });
