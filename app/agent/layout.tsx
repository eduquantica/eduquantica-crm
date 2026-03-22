import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AgentSidebar from '@/components/agent/AgentSidebar'
import AgentNavbar from '@/components/agent/AgentNavbar'
import EduviChatWidget from '@/components/EduviChatWidget'

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (!['SUB_AGENT', 'BRANCH_MANAGER', 'SUB_AGENT_COUNSELLOR'].includes(session.user.roleName)) {
    redirect('/login')
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
  )
}
