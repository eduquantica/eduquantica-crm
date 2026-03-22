import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import CvBuilderClient from "@/app/student/cv-builder/CvBuilderClient";

export default async function AgentCvBuilderPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "SUB_AGENT") {
    redirect("/login");
  }

  return <CvBuilderClient roleName={session.user.roleName} />;
}
