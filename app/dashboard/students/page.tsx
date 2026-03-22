import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import StudentsClient from "./StudentsClient";

export default async function StudentsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user.roleName ?? "ADMIN";

  const [counsellors, subAgents] = await Promise.all([
    db.user.findMany({
      where: { isActive: true, role: { name: "COUNSELLOR" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.subAgent.findMany({
      where: { isApproved: true },
      select: { id: true, agencyName: true },
      orderBy: { agencyName: "asc" },
    }),
  ]);

  return (
    <StudentsClient
      role={role}
      counsellors={counsellors.map((c) => ({ id: c.id, name: c.name ?? c.id }))}
      subAgents={subAgents}
    />
  );
}
