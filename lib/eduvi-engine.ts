import { ChatSessionType, type ChatMessage, type EduviKnowledgeBase } from "@prisma/client";

type ConversationTurn = Pick<ChatMessage, "role" | "content" | "language" | "createdAt">;

type StudentContext = {
  name?: string | null;
  nationality?: string | null;
  applications?: Array<{ university: string; course: string; stage: string }>;
  pendingDocuments?: string[];
  counsellorName?: string | null;
};

type LeadContext = {
  name?: string;
  email?: string;
  phone?: string;
  nationality?: string;
  studyInterest?: string;
  country?: string;
  requestedCounsellor?: boolean;
};

type PublicFlowContext = {
  hasStudyIntent: boolean;
  country?: string;
  level?: string;
  docsReady?: "yes" | "no";
};

export type EduviResponse = {
  response: string;
  language: string;
  shouldCaptureLead: boolean;
  shouldHandoff: boolean;
};

export type GetEduviResponseParams = {
  message: string;
  sessionType: ChatSessionType;
  conversationHistory: ConversationTurn[];
  studentContext?: StudentContext;
  language?: string;
  knowledgeBase: EduviKnowledgeBase[];
  leadContext?: LeadContext;
};

const BASE_RULES = `You are Eduvi, the AI assistant of EduQuantica.
Always:
- Be warm, friendly, encouraging, and concise.
- Use first name when known.
- Give specific answers and end with a helpful follow-up offer.
- Keep responses under 150 words unless a detailed answer is needed.
- Respond in the same language as the user.
Never:
- Invent information not grounded in knowledge context.
- Promise visa approval outcomes.
- Provide definitive legal or immigration advice.
- Reveal private CRM data to public visitors.
When unsure:
"That is a great question. For the most accurate answer on your specific situation I recommend speaking with one of our counsellors. Would you like me to arrange that for you?"
Escalate when user mentions: visa refusal history, complex immigration law, distress, urgency, or words human/counsellor/agent/help me/urgent/emergency.`;

const PUBLIC_PROMPT = `You are Eduvi, a friendly and helpful education assistant for EduQuantica.
Goal: help prospective students with studying abroad and connect them with counsellors.
Conversation flow:
1) Greet warmly
2) Ask visitor interest
3) Answer with knowledge base
4) Gently gather name, email, phone, nationality, study interest, destination country
5) Offer free consultation
6) Capture lead when enough information is gathered
Lead capture trigger phrases:
- I want to apply
- How do I start
- Can someone help me
- I need guidance
- Can I speak to someone`;

function buildKnowledgeContext(knowledgeBase: EduviKnowledgeBase[]) {
  return knowledgeBase
    .map((item) => `Category: ${item.category}\nTitle: ${item.title}\nTags: ${item.tags.join(", ")}\nContent:\n${item.content}`)
    .join("\n\n---\n\n");
}

function buildSessionPrompt(params: GetEduviResponseParams) {
  const kb = buildKnowledgeContext(params.knowledgeBase);

  if (params.sessionType === ChatSessionType.PUBLIC_VISITOR) {
    return `${BASE_RULES}\n\n${PUBLIC_PROMPT}\n\nKnowledge Base:\n${kb}`;
  }

  if (params.sessionType === ChatSessionType.LOGGED_IN_STUDENT) {
    const sc = params.studentContext;
    return `${BASE_RULES}
You are Eduvi, a personal study assistant for ${sc?.name || "the student"} applying through EduQuantica.
Student profile:
- Name: ${sc?.name || "Unknown"}
- Nationality: ${sc?.nationality || "Unknown"}
- Applications: ${(sc?.applications || []).map((a) => `${a.university} / ${a.course} (${a.stage})`).join("; ") || "None"}
- Pending documents: ${(sc?.pendingDocuments || []).join(", ") || "None"}
- Assigned counsellor: ${sc?.counsellorName || "Not assigned"}
Role:
- Explain student-specific application stages and next steps
- Explain pending documents clearly
- Answer visa guidance using knowledge base
- Suggest contacting counsellor for complex questions
Knowledge Base:
${kb}`;
  }

  return `${BASE_RULES}
You are Eduvi, an intelligent assistant for EduQuantica staff.
Help with: quick student status lookup, visa requirements, process Q&A, concise drafts.
Be concise and professional.
Knowledge Base:
${kb}`;
}

function mapHistory(conversationHistory: ConversationTurn[]) {
  return conversationHistory.map((entry) => ({
    role: (entry.role === "ASSISTANT" ? "assistant" : "user") as "assistant" | "user",
    content: entry.content,
  }));
}

const COUNTRY_PATTERNS = [
  "uk",
  "united kingdom",
  "usa",
  "united states",
  "canada",
  "australia",
  "ireland",
  "new zealand",
  "germany",
  "france",
  "italy",
  "spain",
  "malaysia",
  "dubai",
  "uae",
  "sweden",
  "netherlands",
];

function extractPublicFlowContext(history: ConversationTurn[]): PublicFlowContext {
  const userText = history
    .filter((turn) => turn.role === "USER")
    .map((turn) => turn.content.toLowerCase())
    .join("\n");

  const hasStudyIntent = [
    "study abroad",
    "want to study",
    "i want to apply",
    "how do i apply",
    "how do i start",
    "admission",
  ].some((token) => userText.includes(token));

  const country = COUNTRY_PATTERNS.find((token) => userText.includes(token));

  const level = ["bachelor", "undergraduate", "masters", "master", "phd", "doctorate", "diploma", "foundation"]
    .find((token) => userText.includes(token));

  let docsReady: "yes" | "no" | undefined;
  if (["documents ready", "docs ready", "i have my documents", "yes", "ready"].some((token) => userText.includes(token))) {
    docsReady = "yes";
  }
  if (["not ready", "don't have", "do not have", "missing documents", "no"].some((token) => userText.includes(token))) {
    docsReady = "no";
  }

  return {
    hasStudyIntent,
    country,
    level,
    docsReady,
  };
}

function hasStudyIntentInText(text: string) {
  return [
    "study abroad",
    "want to study",
    "i want to apply",
    "how do i apply",
    "how do i start",
    "admission",
  ].some((token) => text.includes(token));
}

function extractDocReadinessFromText(text: string): "yes" | "no" | undefined {
  if (["not ready", "don't have", "do not have", "missing documents"].some((token) => text.includes(token))) {
    return "no";
  }

  if (["documents ready", "docs ready", "i have my documents", "i have all documents"].some((token) => text.includes(token))) {
    return "yes";
  }

  if (/^\s*(yes|yeah|yep)\b/.test(text)) return "yes";
  if (/^\s*(no|nope|not yet)\b/.test(text)) return "no";
  return undefined;
}

function getLastUserMessage(history: ConversationTurn[]) {
  const turns = history.filter((turn) => turn.role === "USER");
  return turns.at(-1)?.content.toLowerCase() || "";
}

function getDeterministicPublicFlowReply(params: GetEduviResponseParams): string | null {
  if (params.sessionType !== ChatSessionType.PUBLIC_VISITOR) return null;

  const history = params.conversationHistory;
  const lastUserMessage = getLastUserMessage(history);
  const priorHistory = history.slice(0, -1);
  const priorFlow = extractPublicFlowContext(priorHistory);

  if (!priorFlow.hasStudyIntent && hasStudyIntentInText(lastUserMessage)) {
    return "Great choice, and I would love to help you study abroad. Which country are you planning to apply to?";
  }

  if (priorFlow.hasStudyIntent && !priorFlow.country && COUNTRY_PATTERNS.some((token) => lastUserMessage.includes(token))) {
    return "Perfect. Which study level are you targeting: Bachelor's, Master's, Diploma, or PhD?";
  }

  if (
    priorFlow.hasStudyIntent
    && Boolean(priorFlow.country)
    && !priorFlow.level
    && ["bachelor", "undergraduate", "masters", "master", "phd", "doctorate", "diploma", "foundation"]
      .some((token) => lastUserMessage.includes(token))
  ) {
    return "Thanks, that helps. Do you already have your core documents ready (passport, transcripts, English test, and SOP)?";
  }

  if (
    priorFlow.hasStudyIntent
    && Boolean(priorFlow.country)
    && Boolean(priorFlow.level)
    && !priorFlow.docsReady
    && extractDocReadinessFromText(lastUserMessage)
  ) {
    return "Excellent. Based on your country and study level, I can now guide your next steps for applications, documents, and visa preparation. Would you like a step-by-step plan now?";
  }

  if (priorFlow.hasStudyIntent && !priorFlow.country) {
    return "Great choice, and I would love to help you study abroad. Which country are you planning to apply to?";
  }

  return null;
}

async function callClaude(system: string, messages: Array<{ role: "user" | "assistant"; content: string }>) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "I can help with studying abroad, applications, documents, visa basics, and next steps. Would you like personalised support from a counsellor as well?";
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
      max_tokens: 800,
      temperature: 0.3,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    return "I’m here to help with applications, visa guidance, and your next steps. Would you like me to connect you with a counsellor for personalised support?";
  }

  const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  return payload.content?.find((part) => part.type === "text")?.text?.trim()
    || "I can help with that. Would you like me to connect you with a counsellor for personalised guidance?";
}

export function shouldTriggerLeadCapture(message: string, leadContext?: LeadContext) {
  const normalized = message.toLowerCase();
  const trigger = [
    "i want to apply",
    "how do i start",
    "can someone help me",
    "i need guidance",
    "can i speak to someone",
    "talk to a counsellor",
    "speak to a counsellor",
  ].some((phrase) => normalized.includes(phrase));

  const enoughContext = Boolean(
    leadContext?.name
    && leadContext?.email
    && leadContext?.phone
    && leadContext?.nationality
    && leadContext?.studyInterest
    && leadContext?.country,
  );

  return trigger || enoughContext;
}

export function shouldEscalateToHuman(message: string) {
  const normalized = message.toLowerCase();
  return ["human", "counsellor", "agent", "help me", "urgent", "emergency", "visa refusal"].some((token) =>
    normalized.includes(token),
  );
}

export async function detectLanguageCode(text: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "en";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
        max_tokens: 30,
        temperature: 0,
        system: "Detect the language and return only ISO 639-1 code.",
        messages: [{ role: "user", content: text }],
      }),
    });

    if (!response.ok) return "en";
    const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const code = payload.content?.find((part) => part.type === "text")?.text?.trim().toLowerCase() || "en";
    return /^[a-z]{2}$/.test(code) ? code : "en";
  } catch {
    return "en";
  }
}

const LANGUAGE_NAME: Record<string, string> = {
  en: "English",
  bn: "Bengali",
  hi: "Hindi",
  ur: "Urdu",
  zh: "Mandarin Chinese",
  ar: "Arabic",
  fr: "French",
  pt: "Portuguese",
  tr: "Turkish",
  ne: "Nepali",
};

export async function translateResponse(text: string, targetLanguage: string): Promise<string> {
  if (!targetLanguage || targetLanguage === "en") return text;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return text;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
        max_tokens: 900,
        temperature: 0.2,
        system: "You are a precise translator. Return translation only.",
        messages: [
          {
            role: "user",
            content: `Translate this to ${LANGUAGE_NAME[targetLanguage] || targetLanguage} naturally, keeping a friendly and professional tone:\n\n${text}`,
          },
        ],
      }),
    });

    if (!response.ok) return text;
    const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    return payload.content?.find((part) => part.type === "text")?.text?.trim() || text;
  } catch {
    return text;
  }
}

export async function getEduviResponse(params: GetEduviResponseParams): Promise<EduviResponse> {
  const inferredLanguage = params.language || (await detectLanguageCode(params.message));

  const deterministicPublicReply = getDeterministicPublicFlowReply(params);
  if (deterministicPublicReply) {
    const translatedDeterministic = await translateResponse(deterministicPublicReply, inferredLanguage);
    return {
      response: translatedDeterministic,
      language: inferredLanguage,
      shouldCaptureLead: params.sessionType === ChatSessionType.PUBLIC_VISITOR && shouldTriggerLeadCapture(params.message, params.leadContext),
      shouldHandoff: shouldEscalateToHuman(params.message),
    };
  }

  const system = buildSessionPrompt(params);

  const assistantEnglish = await callClaude(system, mapHistory(params.conversationHistory));

  const translated = await translateResponse(assistantEnglish, inferredLanguage);

  return {
    response: translated,
    language: inferredLanguage,
    shouldCaptureLead: params.sessionType === ChatSessionType.PUBLIC_VISITOR && shouldTriggerLeadCapture(params.message, params.leadContext),
    shouldHandoff: shouldEscalateToHuman(params.message),
  };
}
