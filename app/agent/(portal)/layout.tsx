import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AgentSidebar from "@/components/agent/AgentSidebar";
import AgentNavbar from "@/components/agent/AgentNavbar";
import EduviChatWidget from "@/components/EduviChatWidget";

// Signed-in agent portal only. Public pages (/agent/register, /agent/apply, /agent/pending)
// live outside this group so logged-out partners can reach them.
export default async function AgentPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !["SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"].includes(session.user.roleName)) {
    redirect("/login");
  }

  return (
    <div className="portal-bg flex h-screen overflow-hidden">
      <AgentSidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <AgentNavbar />
        <main className="portal-main flex-1 overflow-y-auto">
          {children}
        </main>
        <EduviChatWidget
          sessionType="LOGGED_IN_STAFF"
          userId={session.user.id}
          userName={session.user.name}
        />
      </div>
    </div>
  );
}
