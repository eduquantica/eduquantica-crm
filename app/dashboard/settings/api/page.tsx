import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ApiKeyClient from "./ApiKeyClient";

export default async function ApiSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.roleName !== "ADMIN") redirect("/dashboard");

  const apiKey = process.env.API_KEY || "";
  const facebookVerifyToken = process.env.FACEBOOK_VERIFY_TOKEN || "";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">API & Integrations</h2>
      <ApiKeyClient initialKey={apiKey} facebookVerifyToken={facebookVerifyToken} />
    </div>
  );
}
