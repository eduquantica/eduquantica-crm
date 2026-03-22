import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import TasksClient from "./TasksClient";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return <div className="p-6">Unauthorized</div>;
  }

  // load counsellors for dropdowns
  const counsellors = await db.user.findMany({
    where: { roleId: { equals: "COUNSELLOR" } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return <TasksClient counsellors={counsellors} />;
}
