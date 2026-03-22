import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar'
import DashboardNavbar from '@/components/dashboard/DashboardNavbar'
import EduviChatWidget from '@/components/EduviChatWidget'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const allowedRoles = ['ADMIN', 'MANAGER', 'COUNSELLOR']
  const role = session.user.roleName
  if (!allowedRoles.includes(role)) {
    redirect('/login')
  }
  return (
    <div className="portal-bg flex h-screen overflow-hidden">
      <DashboardSidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <DashboardNavbar />
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
