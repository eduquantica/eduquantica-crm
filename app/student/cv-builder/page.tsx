import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import CvBuilderClient from "./CvBuilderClient";

export default async function StudentCvBuilderPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.roleName !== "STUDENT") {
    redirect("/login");
  }

  return <CvBuilderClient roleName={session.user.roleName} />;
}
