import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import UniversityDetailClient from "./UniversityDetailClient";

export const metadata = {
  title: "University Details",
  description: "View and manage university details",
};

export default async function UniversityDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER" && session.user.roleName !== "COUNSELLOR")) {
    redirect("/dashboard");
  }

  return <UniversityDetailClient universityId={params.id} />;
}
