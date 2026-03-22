import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import VisaListClient from "./VisaListClient";
import { COUNTRIES } from "@/lib/countries";

export default async function VisaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return <div className="p-6">Unauthorized</div>;
  }

  const counsellors = await db.user.findMany({
    where: { roleId: { equals: "COUNSELLOR" } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return <VisaListClient counsellors={counsellors} countries={COUNTRIES} />;
}
