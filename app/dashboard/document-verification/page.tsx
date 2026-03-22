import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import DocumentVerificationClient from "./DocumentVerificationClient";

export default async function DocumentVerificationPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user.roleName || "COUNSELLOR";

  return <DocumentVerificationClient role={role} />;
}
