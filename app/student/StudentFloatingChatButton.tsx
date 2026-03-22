"use client";

import Link from "next/link";
import { BotMessageSquare } from "lucide-react";

type Props = {
  unreadCount: number;
};

export default function StudentFloatingChatButton({ unreadCount }: Props) {
  return (
    <div className="fixed bottom-5 right-5 z-40 group">
      <Link
        href="/student/messages#eduvi"
        aria-label="Chat with Eduvi"
        className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#1E3A5F] text-white shadow-lg transition hover:scale-[1.02] hover:opacity-95"
      >
        <BotMessageSquare className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
      <div className="pointer-events-none absolute bottom-16 right-0 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow transition group-hover:opacity-100">
        Chat with Eduvi - your study adviser
      </div>
    </div>
  );
}