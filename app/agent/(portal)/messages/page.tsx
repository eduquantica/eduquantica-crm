"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";

type StudentThread = {
  studentId: string;
  studentName: string;
  unreadCount: number;
  latestMessage: string;
  latestAt: string | null;
};

type Message = {
  id: string;
  content: string;
  senderName: string;
  senderRole: string;
  sentAt: string;
  attachmentUrl?: string | null;
};

function bubbleClass(role: string) {
  if (role === "SUB_AGENT") return "ml-auto bg-blue-600 text-white";
  if (role === "STUDENT") return "bg-emerald-100 text-emerald-900";
  return "bg-slate-100 text-slate-900";
}

export default function AgentMessagesPage() {
  const [students, setStudents] = useState<StudentThread[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/messages");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load students");
      const list: StudentThread[] = json.data || [];
      setStudents(list);
      setSelectedStudentId((current) => current || list[0]?.studentId || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const fetchMessages = useCallback(async (studentId: string) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const res = await fetch(`/api/messages/${studentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load messages");
      setMessages(json.messages || []);
      await fetchStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, [fetchStudents]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    if (!selectedStudentId) return;
    fetchMessages(selectedStudentId);
  }, [selectedStudentId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.studentId === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  async function handleAttachment(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json() as { urls?: string[]; error?: string; message?: string };
      if (!res.ok || !json.urls?.[0]) throw new Error(json.error || "Attachment upload failed");
      setAttachmentUrl(json.urls[0]);
      setAttachmentName(json.message ? `${file.name} — ${json.message}` : file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attachment upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudentId) return;
    if (!messageInput.trim() && !attachmentUrl) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/messages/${selectedStudentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: messageInput.trim() || "Attachment",
          attachmentUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send message");

      setMessageInput("");
      setAttachmentUrl(null);
      setAttachmentName(null);
      await fetchMessages(selectedStudentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl h-[78vh] overflow-hidden flex">
      <aside className="w-80 border-r border-slate-200 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200">
          <h1 className="text-lg font-semibold text-slate-900">Messages</h1>
          <p className="text-xs text-slate-500">Shared thread with dashboard communications.</p>
        </div>

        <div className="overflow-y-auto flex-1">
          {loadingStudents ? (
            <div className="p-4 text-sm text-slate-500">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">No students available.</div>
          ) : (
            students.map((student) => (
              <button
                key={student.studentId}
                onClick={() => setSelectedStudentId(student.studentId)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${
                  selectedStudentId === student.studentId ? "bg-slate-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-slate-900 truncate">{student.studentName}</p>
                  {student.unreadCount > 0 && (
                    <span className="ml-2 inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-semibold">
                      {student.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{student.latestMessage || "No messages yet"}</p>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-3 border-b border-slate-200 min-h-[57px]">
          <h2 className="text-sm font-semibold text-slate-900">{selectedStudent?.studentName || "Select a student"}</h2>
        </div>

        {error && <div className="mx-4 mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{error}</div>}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/40">
          {!selectedStudentId ? (
            <div className="text-sm text-slate-500">Select a student to start messaging.</div>
          ) : loadingMessages ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-sm text-slate-500">No messages yet.</div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`max-w-[75%] rounded-xl px-3 py-2 shadow-sm ${bubbleClass(message.senderRole)}`}>
                <p className="text-xs opacity-80 mb-1">{message.senderName} • {message.senderRole}</p>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.attachmentUrl && (
                  <a
                    href={message.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block mt-2 text-xs underline ${message.senderRole === "SUB_AGENT" ? "text-blue-100" : "text-blue-700"}`}
                  >
                    View attachment
                  </a>
                )}
                <p className="text-[11px] opacity-75 mt-1">{new Date(message.sentAt).toLocaleString()}</p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="border-t border-slate-200 p-3 space-y-2">
          {attachmentName && (
            <div className="text-xs text-slate-600">Attached: {attachmentName}</div>
          )}
          <div className="flex items-end gap-2">
            <label className="h-10 w-10 shrink-0 rounded-md border border-slate-300 hover:bg-slate-50 flex items-center justify-center cursor-pointer">
              <Paperclip className="w-4 h-4 text-slate-600" />
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAttachment(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              rows={2}
              placeholder="Type a message..."
              className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm resize-none"
              disabled={!selectedStudentId || sending || uploading}
            />
            <button
              type="submit"
              disabled={!selectedStudentId || sending || uploading || (!messageInput.trim() && !attachmentUrl)}
              className="h-10 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
