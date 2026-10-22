import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import BrandLogo from "@/components/ui/BrandLogo";

export const dynamic = "force-dynamic";

// Where unapproved sub-agents land after login: shows what they need to do next.
export default async function AgentPendingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const agent = session.user.roleName === "SUB_AGENT"
    ? await db.subAgent.findUnique({
        where: { userId: session.user.id },
        select: {
          approvalStatus: true,
          rejectionReason: true,
          businessRegistration: { select: { submittedAt: true, currentStep: true } },
          infoRequests: {
            where: { agentResponse: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { adminMessage: true },
          },
        },
      })
    : null;

  const registration = agent?.businessRegistration;
  const started = Boolean(registration);
  const submittedAt = registration?.submittedAt ?? null;

  let title = "Account Pending Approval";
  let body: React.ReactNode = <p>Your account is awaiting approval.</p>;
  let action: { href: string; label: string } | null = null;

  if (agent?.approvalStatus === "APPROVED") {
    title = "Your account is active";
    body = <p>Your partner account has been approved. If the portal doesn&apos;t open yet, sign out and back in.</p>;
    action = { href: "/agent/dashboard", label: "Go to your dashboard" };
  } else if (agent?.approvalStatus === "REJECTED") {
    title = "Application not approved";
    body = (
      <>
        <p>Unfortunately your partner application was not approved.</p>
        {agent.rejectionReason && <p className="mt-2 text-slate-800">{agent.rejectionReason}</p>}
      </>
    );
    action = { href: "/agent/business-registration", label: "View your registration" };
  } else if (agent?.approvalStatus === "INFO_REQUESTED") {
    title = "More information needed";
    body = (
      <>
        <p>Our team has asked for more information before approving your account.</p>
        {agent.infoRequests[0] && (
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-blue-50 px-4 py-3 text-left text-blue-900">{agent.infoRequests[0].adminMessage}</p>
        )}
      </>
    );
    action = { href: "/agent/business-registration", label: "Update and resubmit" };
  } else if (agent && !submittedAt) {
    title = "Complete your business registration";
    body = (
      <p>
        To activate your account, tell us about your agency and upload your business documents, including your British Council
        agent certificate. It takes about 10 minutes and your answers are saved as you go.
      </p>
    );
    action = {
      href: "/agent/business-registration",
      label: started ? `Continue registration (step ${registration?.currentStep ?? 1} of 4)` : "Start registration",
    };
  } else if (agent && submittedAt) {
    title = "Registration under review";
    body = (
      <p>
        Thank you. Your business registration was submitted on {submittedAt.toLocaleDateString("en-GB")}. We usually review
        applications within 2-3 business days and will email you when your account is active.
      </p>
    );
    action = { href: "/agent/business-registration", label: "View your registration" };
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <div className="flex justify-center"><BrandLogo width={180} /></div>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">{title}</h1>
        <div className="text-slate-600 mt-3 text-sm leading-relaxed">{body}</div>
        {action && (
          <Link href={action.href} className="inline-block mt-6 eq-primary-btn rounded-lg px-5 py-2.5 text-sm font-semibold">
            {action.label}
          </Link>
        )}
        <p className="mt-6 text-xs text-slate-400">
          Signed in as {session.user.email}. <Link href="/api/auth/signout" className="underline">Sign out</Link>
        </p>
      </div>
    </div>
  );
}
