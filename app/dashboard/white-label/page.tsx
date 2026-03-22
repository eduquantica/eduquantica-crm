import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import WhiteLabelClient from "./WhiteLabelClient";

export const metadata = {
  title: "White Label Marketing",
};

export default async function WhiteLabelPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.roleName !== "ADMIN" && session.user.roleName !== "MANAGER")) {
    redirect("/dashboard");
  }

  return <WhiteLabelClient />;
}
