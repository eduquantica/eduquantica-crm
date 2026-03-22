"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  MessageSquare,
  Phone as PhoneIcon,
  Settings,
  Search as SearchIcon,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface Thread {
  type: "lead" | "student";
  id: string;
  name: string;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
  lastMessageType: string;
}

interface Message {
  id: string;
  type: string;
  subject?: string | null;
  message: string;
  attachmentUrl?: string | null;
  direction: string;
  createdAt: string;
  user: { id: string; name: string | null; roleName: string };
}

export default function CommunicationsClient() {
  const [filter, setFilter] = useState<"ALL" | "EMAIL" | "NOTE" | "CALL" | "UNREAD">("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  // const [sending, setSending] = useState(false);
  const [lastViewed] = useState<Record<string, number>>({});

  const queryClient = useQueryClient();

  const { data: threadsData, isLoading: threadsLoading } = useQuery({
    queryKey: ["communications", filter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter) params.set("filter", filter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/dashboard/communications/threads?${params}`);
      if (!res.ok) throw new Error("Failed to load threads");
      return res.json();
    },
  });


  // fetch message list when selected changes (handled by useQuery below)
  // const messagesQuery = useQuery([
  //   "commMessages",
  //   selected?.type,
  //   selected?.id,
  // ],
  // () => (selected ? fetchMessages(selected) : Promise.resolve([])),
  // {
  //   enabled: !!selected,
  //   onSuccess: (msgs) => {
  //     setMessages(msgs);
  //     if (selected) {
  //       // mark thread as viewed
  //       setLastViewed((prev) => ({ ...prev, [`${selected.type}:${selected.id}`]: Date.now() }));
  //     }
  //   },
  // });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("No thread selected");
      const path = selected.type === "lead" ? "leads" : "students";
      const res = await fetch(`/api/dashboard/communications/${path}/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body, type: "NOTE" }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (data) => {
      setBody("");
      setMessages((prev) => [...prev, data.communication]);
      queryClient.invalidateQueries({ queryKey: ["communications"] });
    },
  });

  const handleFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    const res = await fetch(`/api/upload`, { method: "POST", body: form });
    const data = await res.json() as { urls?: string[]; error?: string; message?: string };
    if (data.urls && data.urls.length > 0) {
      const uploadedUrl = data.urls[0];
      // append link to body
      setBody((b) => {
        const messageLine = data.message ? `\nUpload: ${data.message}` : "";
        return b + `\nAttachment: ${uploadedUrl}${messageLine}`;
      });
    }
  };

  const threads: Thread[] = threadsData?.threads || [];

  const filteredThreads = threads; // already filtered by server

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { hour12: false });

  const iconForType = (type: string) => {
    switch (type) {
      case "EMAIL":
        return <Mail className="w-4 h-4" />;
      case "CALL":
        return <PhoneIcon className="w-4 h-4" />;
      case "NOTE":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex h-full">
      {/* sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col overflow-hidden">
        {/* filters */}
        <div className="flex p-2 gap-1">
          {(["ALL", "EMAIL", "NOTE", "CALL", "UNREAD"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2 py-1 text-sm rounded",
                filter === f
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              {f === "ALL" ? "All" : f === "UNREAD" ? "Unread" : f}
            </button>
          ))}
        </div>

        {/* search */}
        <div className="p-2">
          <div className="relative">
            <SearchIcon className="w-4 h-4 text-gray-400 absolute left-2 top-2" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2 py-1 border border-gray-300 rounded"
            />
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-auto">
          {threadsLoading ? (
            <p className="p-4 text-center text-sm text-gray-500">Loading…</p>
          ) : filteredThreads.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-500">No threads</p>
          ) : (
            filteredThreads.map((t) => {
              const key = `${t.type}:${t.id}`;
              const isSelected = selected && selected.type === t.type && selected.id === t.id;
              const unread = lastViewed[key]
                ? new Date(t.lastAt).getTime() > lastViewed[key]
                : t.unreadCount > 0;
              return (
                <div
                  key={key}
                  onClick={() => setSelected(t)}
                  className={cn(
                    "flex items-center p-2 cursor-pointer hover:bg-gray-100",
                    isSelected && "bg-gray-100"
                  )}
                >
                  <div className="flex-shrink-0 mr-2">
                    {iconForType(t.lastMessageType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {t.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {t.lastMessage}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 ml-2">
                    {formatDate(t.lastAt)}
                  </div>
                  {unread && (
                    <span className="ml-2 inline-block bg-red-500 text-white text-xs px-1 rounded-full">
                      {t.unreadCount}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* conversation panel */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className="flex-1 overflow-auto p-4 space-y-4" id="messages-container">
              {messages.map((m) => {
                const isCounsellor = m.user.roleName === "COUNSELLOR";
                const isSubagent = m.user.roleName === "SUB_AGENT";
                const isSystem = m.user.roleName === "SYSTEM";
                const align = isCounsellor ? "justify-end" : "justify-start";
                const bg = isCounsellor
                  ? "bg-blue-100 text-gray-900"
                  : isSubagent
                  ? "bg-green-100 text-gray-900"
                  : isSystem
                  ? "bg-gray-100 text-gray-600 italic"
                  : "bg-gray-200 text-gray-900";
                const containerClass = isSystem ? "justify-center" : align;
                return (
                  <div key={m.id} className={`flex ${containerClass}`}> 
                    <div className={`max-w-[60%] p-3 rounded-lg ${bg}`}> 
                      <div className="text-xs font-semibold">
                        {m.user.name || "Unknown"}  
                        <span className="ml-2 text-gray-500 text-[10px]">{m.user.roleName}</span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap">{m.message}</div>
                      {m.attachmentUrl && (
                        <div className="mt-2">
                          <a href={m.attachmentUrl} className="text-blue-600 underline">
                            Attachment
                          </a>
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1 text-right">
                        {formatDate(m.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* compose area */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <textarea
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Type a message..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <button className="p-2" aria-label="attach file">
                  <Paperclip className="w-5 h-5" />
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => handleFile(e.target.files)}
                  />
                </button>
                <button
                  onClick={() => sendMutation.mutate()}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  disabled={!body.trim() || (sendMutation as any).isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a thread to view messages
          </div>
        )}
      </div>
    </div>
  );
}
