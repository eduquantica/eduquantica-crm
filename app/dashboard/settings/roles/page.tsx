import { db } from "@/lib/db";
import RolesClient from "./RolesClient";

export default async function RolesPage() {
  const roles = await db.role.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      label: true,
      isBuiltIn: true,
      createdAt: true,
      permissions: {
        select: { module: true, canView: true, canCreate: true, canEdit: true, canDelete: true },
      },
      _count: { select: { users: true } },
    },
  });

  return <RolesClient roles={roles} />;
}
