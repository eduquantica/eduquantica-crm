import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getPortalPath } from "@/lib/portal";
import NotificationsClient from "./NotificationsClient";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const homePath = getPortalPath(session.user.roleName, session.user.subAgentApproved);

  return <NotificationsClient homePath={homePath} />;
}
