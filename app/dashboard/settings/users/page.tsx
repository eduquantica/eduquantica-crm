import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import UsersClient from "./UsersClient";

const EXCLUDED_ROLES = ["STUDENT", "SUB_AGENT"];
const PAGE_SIZE = 20;

interface PageProps {
  searchParams: { search?: string; roleId?: string; page?: string };
}

export default async function UsersPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const search = searchParams.search?.trim() ?? "";
  const roleId = searchParams.roleId ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    role: { name: { notIn: EXCLUDED_ROLES } },
    ...(roleId ? { roleId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, total, staffRoles] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, name: true, label: true, isBuiltIn: true } },
      },
    }),
    db.user.count({ where }),
    db.role.findMany({
      where: { name: { notIn: EXCLUDED_ROLES } },
      orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
      select: { id: true, name: true, label: true },
    }),
  ]);

  return (
    <UsersClient
      users={users}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      staffRoles={staffRoles}
      currentAdminId={session!.user.id}
    />
  );
}
