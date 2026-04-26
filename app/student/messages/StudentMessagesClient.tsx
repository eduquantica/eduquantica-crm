"use client";

import { MessagesThread } from "@/components/MessagesThread";

export default function StudentMessagesClient({ studentId }: { studentId: string }) {
  return (
    <div className="w-full space-y-4 px-5 py-6 sm:px-7">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Messages</h2>
        <p className="mt-2 text-sm text-slate-600">Chat with your counsellor and support team about your applications.</p>
      </div>

      <div className="h-[600px]">
        <MessagesThread studentId={studentId} />
      </div>
    </div>
  );
}
