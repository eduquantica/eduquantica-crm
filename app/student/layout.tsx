import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import StudentSidebar from '@/components/student/StudentSidebar'
import StudentNavbar from '@/components/student/StudentNavbar'
import EduviChatWidget from '@/components/EduviChatWidget'
import StudentThemeProvider from '@/components/student/StudentThemeProvider'

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.roleName !== 'STUDENT') {
    redirect('/login')
  }
  return (
    <StudentThemeProvider>
      <div className="flex h-screen overflow-hidden bg-[#F0F4FF] dark:bg-slate-950 transition-colors duration-200">
        <StudentSidebar />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <StudentNavbar />
          <main className="flex-1 overflow-y-auto p-6 bg-[#F0F4FF] dark:bg-slate-900 transition-colors duration-200">
            {children}
          </main>
          <EduviChatWidget
            sessionType="LOGGED_IN_STUDENT"
            userId={session.user.id}
            userName={session.user.name}
          />
        </div>
      </div>
    </StudentThemeProvider>
  )
}
