import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import UniversitiesClient from "./UniversitiesClient";

export const metadata = {
  title: "Universities",
  description: "Manage universities and partner institutions",
};

export default async function UniversitiesPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "COUNSELLOR")) {
    redirect("/dashboard");
  }

  // Fetch all distinct countries for the filter dropdown
  const countries = await db.university.findMany({
    where: { isActive: true },
    select: { country: true },
    distinct: ["country"],
    orderBy: { country: "asc" },
  });

  return <UniversitiesClient initialCountries={countries.map((c) => c.country)} />;
}
