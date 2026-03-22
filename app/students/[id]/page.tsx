import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

type PageProps = {
  params: { id: string };
};

export default async function StudentDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const roleName = session?.user?.roleName;

  if (!session?.user || !roleName) {
    redirect("/login");
  }

  if (["SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"].includes(roleName)) {
    redirect(`/agent/students/${params.id}`);
  }

  if (["ADMIN", "MANAGER", "COUNSELLOR"].includes(roleName)) {
    redirect(`/dashboard/students/${params.id}`);
  }

  if (roleName === "STUDENT") {
    redirect("/student/profile");
  }

  redirect("/login");
}
