"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  ChevronDown,
  Globe,
  Mic,
  Send,
  Speaker,
  Square,
  VolumeX,
  X,
} from "lucide-react";

type SessionType = "PUBLIC_VISITOR" | "LOGGED_IN_STUDENT" | "LOGGED_IN_STAFF";
type ChatRole = "USER" | "ASSISTANT" | "SYSTEM";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  language: string;
  createdAt: string;
};

type LeadFormState = {
  name: string;
  email: string;
  phone: string;
  nationality: string;
  studyInterest: string;
  country: string;
};

type SpeechRecognitionResultEventLike = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  start: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type Props = {
  sessionType: SessionType;
  userId?: string;
  userName?: string | null;
  hideOnAuthRoutes?: boolean;
};

const PUBLIC_QUICK_REPLIES = [
  "🎓 I want to study abroad",
  "📋 How do I apply?",
  "💰 What are the fees?",
  "🛂 Visa information",
  "📞 Speak to a counsellor",
];

const STUDENT_QUICK_REPLIES = [
  "📋 My application status",
  "📄 Document help",
  "🎓 Course search",
  "💰 Fees and finance",
  "🛂 Visa questions",
  "💬 Contact my counsellor",
];

const STAFF_QUICK_REPLIES = [
  "🔎 Find student by name",
  "📌 Quick status lookup",
  "🛂 Visa rules summary",
  "✉️ Draft a message",
];

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "🇬🇧 English" },
  { code: "bn", label: "🇧🇩 Bengali" },
  { code: "hi", label: "🇮🇳 Hindi" },
  { code: "ur", label: "🇵🇰 Urdu" },
  { code: "zh", label: "🇨🇳 Mandarin" },
  { code: "ar", label: "🇸🇦 Arabic" },
  { code: "fr", label: "🇫🇷 French" },
  { code: "pt", label: "🇵🇹 Portuguese" },
  { code: "tr", label: "🇹🇷 Turkish" },
  { code: "ne", label: "🇳🇵 Nepali" },
];

function randomVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `visitor_${Math.random().toString(36).slice(2)}`;
}

function getSubtitle(sessionType: SessionType) {
  if (sessionType === "PUBLIC_VISITOR") return "Your Education Assistant";
  if (sessionType === "LOGGED_IN_STUDENT") return "Your Education Assistant";
  return "EduQuantica Assistant";
}

function storageKey(sessionType: SessionType, userId?: string) {
  return `eduvi-widget:${sessionType}:${userId || "visitor"}`;
}

export default function EduviChatWidget({ sessionType, userId, hideOnAuthRoutes = false }: Props) {
  const pathname = usePathname();
  const shouldHide = hideOnAuthRoutes && (pathname.startsWith("/dashboard") || pathname.startsWith("/agent") || pathname.startsWith("/student"));

  const key = storageKey(sessionType, userId);

  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [handoffMessage, setHandoffMessage] = useState("");
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadForm, setLeadForm] = useState<LeadFormState>({
    name: "",
    email: "",
    phone: "",
    nationality: "",
    studyInterest: "",
    country: "",
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const quickReplies = useMemo(() => {
    if (sessionType === "PUBLIC_VISITOR") return PUBLIC_QUICK_REPLIES;
    if (sessionType === "LOGGED_IN_STUDENT") return STUDENT_QUICK_REPLIES;
    return STAFF_QUICK_REPLIES;
  }, [sessionType]);

  useEffect(() => {
    if (shouldHide) return;
    const raw = localStorage.getItem(key);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        open?: boolean;
        sessionId?: string;
        visitorId?: string;
        language?: string;
        messages?: ChatMessage[];
        voiceOutputEnabled?: boolean;
      };

      setOpen(Boolean(parsed.open));
      setSessionId(parsed.sessionId || null);
      setVisitorId(parsed.visitorId || "");
      setLanguage(parsed.language || "en");
      setMessages(parsed.messages || []);
      setVoiceOutputEnabled(Boolean(parsed.voiceOutputEnabled));
    } catch {
      // no-op
    }
  }, [key, shouldHide]);

  useEffect(() => {
    if (shouldHide) return;
    localStorage.setItem(
      key,
      JSON.stringify({
        open,
        sessionId,
        visitorId,
        language,
        messages,
        voiceOutputEnabled,
      }),
    );
  }, [key, open, sessionId, visitorId, language, messages, voiceOutputEnabled, shouldHide]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, showLeadForm, showHandoffForm]);

  useEffect(() => {
    if (shouldHide) return;
    if (sessionId) return;

    void (async () => {
      const nextVisitorId = visitorId || randomVisitorId();
      setVisitorId(nextVisitorId);

      const response = await fetch("/api/chat/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType,
          language,
          visitorId: sessionType === "PUBLIC_VISITOR" ? nextVisitorId : undefined,
        }),
      });

      const payload = (await response.json()) as { data?: { sessionId: string } };
      if (!response.ok || !payload.data?.sessionId) return;

      setSessionId(payload.data.sessionId);

      const historyRes = await fetch(`/api/chat/session/${payload.data.sessionId}/history`);
      const historyPayload = (await historyRes.json()) as { data?: { messages: ChatMessage[] } };
      if (historyRes.ok && historyPayload.data?.messages) {
        setMessages(historyPayload.data.messages);
      }
    })();
  }, [sessionId, language, sessionType, visitorId, shouldHide]);

  useEffect(() => {
    if (!voiceOutputEnabled || shouldHide) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const last = [...messages].reverse().find((message) => message.role === "ASSISTANT");
    if (!last) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(last.content);
    utterance.lang = language;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((voice) => voice.lang.toLowerCase().startsWith(language) && /female|zira|samantha|victoria|aria/i.test(voice.name));
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    };
  }, [messages, language, voiceOutputEnabled, shouldHide]);

  async function detectLanguage(text: string) {
    const response = await fetch("/api/chat/detect-language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const payload = (await response.json()) as { data?: { language: string } };
    if (response.ok && payload.data?.language) {
      setLanguage(payload.data.language);
      return payload.data.language;
    }
    return language;
  }

  async function sendMessage(messageText: string, isVoice = false) {
    if (!sessionId) return;
    const trimmed = messageText.trim().slice(0, 500);
    if (!trimmed) return;

    setShowLangPicker(false);
    setShowHandoffForm(false);

    const userMessage: ChatMessage = {
      id: `tmp-user-${Date.now()}`,
      role: "USER",
      content: trimmed,
      language,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);
    if (!open) setUnreadCount((count) => count + 1);
    setInput("");
    setLoading(true);

    const detectedLanguage = await detectLanguage(trimmed);

    const response = await fetch("/api/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        message: trimmed,
        isVoice,
        language: detectedLanguage,
      }),
    });

    const payload = (await response.json()) as {
      data?: {
        message: ChatMessage;
        actions: { shouldCaptureLead: boolean; shouldHandoff: boolean };
      };
    };

    setLoading(false);

    if (!response.ok || !payload.data?.message) {
      const fallback: ChatMessage = {
        id: `tmp-assistant-${Date.now()}`,
        role: "ASSISTANT",
        content: "I’m having trouble right now. Please try again in a moment.",
        language: detectedLanguage,
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current, fallback]);
      if (!open) setUnreadCount((count) => count + 1);
      return;
    }

    setMessages((current) => [...current, payload.data!.message]);
    if (!open) setUnreadCount((count) => count + 1);

    if (payload.data.actions.shouldCaptureLead && sessionType === "PUBLIC_VISITOR") {
      setShowLeadForm(true);
    }

    if (payload.data.actions.shouldHandoff && sessionType === "PUBLIC_VISITOR") {
      setShowHandoffForm(true);
    }
  }

  async function submitLeadCapture() {
    if (!sessionId) return;

    const response = await fetch("/api/chat/lead-capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        ...leadForm,
        requestedCounsellor: true,
      }),
    });

    if (!response.ok) return;

    const firstName = leadForm.name.trim().split(" ")[0] || "there";
    const confirmation: ChatMessage = {
      id: `lead-confirm-${Date.now()}`,
      role: "ASSISTANT",
      content: `Thank you ${firstName}! A counsellor will contact you within 24 hours. In the meantime feel free to keep asking me questions.`,
      language,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, confirmation]);
    setLeadSubmitted(true);
    setShowLeadForm(false);
  }

  async function submitHandoff() {
    if (!sessionId) return;

    const response = await fetch("/api/chat/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message: handoffMessage.trim() }),
    });

    if (!response.ok) return;

    const confirmation: ChatMessage = {
      id: `handoff-confirm-${Date.now()}`,
      role: "ASSISTANT",
      content:
        "I will let our team know you would like to speak with a counsellor. They typically respond within a few hours during business hours.",
      language,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, confirmation]);
    setShowHandoffForm(false);
    setHandoffMessage("");
  }

  function startVoiceInput() {
    const recognitionApi: SpeechRecognitionConstructor | undefined =
      typeof window !== "undefined"
        ? ((window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
          || (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition)
        : undefined;

    if (!recognitionApi) return;

    const recognition = new recognitionApi();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: SpeechRecognitionResultEventLike) => {
      const transcript = event?.results?.[0]?.[0]?.transcript || "";
      setInput((current) => `${current} ${transcript}`.trim());
      setIsListening(false);
    };

    recognition.start();
  }

  function stopSpeaking() {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  if (shouldHide) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setUnreadCount(0);
          }}
          title="Chat with Eduvi"
          className="relative h-14 w-14 rounded-full bg-amber-500 text-slate-900 shadow-lg ring-4 ring-amber-100 transition hover:scale-[1.02]"
        >
          <Bot className="mx-auto h-7 w-7" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
          <span className="pointer-events-none absolute -top-9 right-0 rounded bg-slate-900 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
            Chat with Eduvi
          </span>
        </button>
      ) : (
        <div className="h-[560px] w-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-sm:fixed max-sm:inset-0 max-sm:h-screen max-sm:w-screen">
          <div className="flex items-start justify-between bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 rounded-full bg-amber-400 p-1 text-slate-900">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold">Eduvi</div>
                <div className="text-xs text-slate-200">{getSubtitle(sessionType)}</div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Online
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setShowLangPicker((current) => !current)} className="rounded p-1 hover:bg-slate-800" aria-label="Language">
                <Globe className="h-4 w-4" />
              </button>

              {typeof window !== "undefined" && "speechSynthesis" in window ? (
                <button
                  type="button"
                  onClick={() => {
                    if (voiceOutputEnabled) stopSpeaking();
                    setVoiceOutputEnabled((current) => !current);
                  }}
                  className="rounded p-1 hover:bg-slate-800"
                  aria-label="Voice output"
                >
                  {voiceOutputEnabled ? <Speaker className="h-4 w-4 text-amber-300" /> : <VolumeX className="h-4 w-4" />}
                </button>
              ) : null}

              {isSpeaking ? (
                <button type="button" onClick={stopSpeaking} className="rounded p-1 hover:bg-slate-800" aria-label="Stop speaking">
                  <Square className="h-4 w-4" />
                </button>
              ) : null}

              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-slate-800" aria-label="Minimise">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-slate-800" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showLangPicker ? (
            <div className="border-b border-slate-200 px-3 py-2">
              <select
                value={language}
                onChange={(event) => {
                  const code = event.target.value;
                  setLanguage(code);
                  const selected = SUPPORTED_LANGUAGES.find((item) => item.code === code)?.label || code;
                  setMessages((current) => [
                    ...current,
                    {
                      id: `lang-${Date.now()}`,
                      role: "ASSISTANT",
                      content: `Hello! I am now speaking in ${selected}. How can I help you?`,
                      language: code,
                      createdAt: new Date().toISOString(),
                    },
                  ]);
                }}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              >
                {SUPPORTED_LANGUAGES.map((item) => (
                  <option key={item.code} value={item.code}>{item.label}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="h-[390px] overflow-y-auto bg-slate-50 px-3 py-3 max-sm:h-[calc(100vh-230px)]">
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "USER" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow ${message.role === "USER" ? "bg-amber-400 text-slate-900" : "bg-white text-slate-800"}`}>
                    {message.content}
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm text-slate-500 shadow">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
                </div>
              ) : null}

              {messages.length <= 1 ? (
                <div className="flex flex-wrap gap-2">
                  {quickReplies.map((reply) => (
                    <button
                      key={reply}
                      type="button"
                      onClick={() => void sendMessage(reply)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              ) : null}

              {showLeadForm ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="mb-2 text-sm font-semibold text-slate-900">Book My Free Consultation</p>
                  <div className="space-y-2">
                    {(["name", "email", "phone", "nationality", "studyInterest", "country"] as const).map((field) => (
                      <input
                        key={field}
                        value={leadForm[field]}
                        onChange={(event) => setLeadForm((current) => ({ ...current, [field]: event.target.value }))}
                        placeholder={field === "studyInterest" ? "Study interest" : field[0].toUpperCase() + field.slice(1)}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">Your details are safe with us.</p>
                  <button
                    type="button"
                    onClick={() => void submitLeadCapture()}
                    className="mt-2 w-full rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-400"
                  >
                    Book My Free Consultation
                  </button>
                </div>
              ) : null}

              {leadSubmitted ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <p className="font-medium">Thanks! Your consultation request has been submitted.</p>
                  <div className="mt-2 flex gap-2">
                    <a href="/register" className="rounded bg-emerald-700 px-2 py-1 text-white">Create an account</a>
                    <a href="/" className="rounded border border-emerald-700 px-2 py-1 text-emerald-700">Explore courses</a>
                  </div>
                </div>
              ) : null}

              {showHandoffForm ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="text-xs text-slate-700">Would you like to leave a message for a counsellor?</p>
                  <textarea
                    value={handoffMessage}
                    onChange={(event) => setHandoffMessage(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                    placeholder="Type your message"
                  />
                  <button
                    type="button"
                    onClick={() => void submitHandoff()}
                    className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Send Message
                  </button>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-3 py-2">
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={startVoiceInput}
                className={`rounded p-2 ${isListening ? "bg-rose-500 text-white animate-pulse" : "bg-slate-100 text-slate-700"}`}
                aria-label="Voice input"
              >
                <Mic className="h-4 w-4" />
              </button>

              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 500))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="Type your message... Or speak using the microphone"
                className="min-h-[40px] flex-1 resize-none rounded border border-slate-300 px-2 py-2 text-sm"
                rows={2}
              />

              <button
                type="button"
                onClick={() => void sendMessage(input)}
                disabled={!input.trim() || loading}
                className="rounded bg-amber-500 p-2 text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
