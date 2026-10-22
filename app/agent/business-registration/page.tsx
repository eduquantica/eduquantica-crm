import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BusinessRegistrationClient from "./BusinessRegistrationClient";

export const dynamic = "force-dynamic";

// Outside the (portal) group on purpose: unapproved sub-agents fill this in before they get portal access.
export default async function BusinessRegistrationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/agent/business-registration");
  if (session.user.roleName !== "SUB_AGENT") redirect("/agent/dashboard");

  return <BusinessRegistrationClient />;
}
