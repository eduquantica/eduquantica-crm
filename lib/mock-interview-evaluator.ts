import { ROUND_SCORE_WEIGHTS } from "@/lib/mock-interview-questions";

type EvalInput = {
  universityAboutText?: string | null;
  coursePageText?: string | null;
  extractedOfferData?: Record<string, unknown> | null;
  sampleQuestionsText?: string | null;
  customInstructions?: string | null;
  previousExchanges: Array<{ question: string; answer?: string | null; roundNumber?: number | null }>;
  question: string;
  answer: string;
};

export type AnswerEvaluationResult = {
  score: number;
  evaluation: string;
  flags: string[];
  inconsistencyDetected: boolean;
  inconsistencyDetail: string;
  followUpNeeded: boolean;
  followUpQuestion: string;
  autoNextQuestion: string;
  suggestedRoundEnd: boolean;
};

export type MockInterviewReportPayload = {
  overallScore: number;
  isPassed: boolean;
  recommendation: string;
  strengths: string[];
  areasToImprove: string[];
  inconsistenciesFound: string[];
  detailedFeedback: string;
  fullTranscript: string;
};

const EVALUATOR_SYSTEM_PROMPT = `You are an experienced UK/US visa officer and university admissions interviewer evaluating whether a student is a genuine applicant.
You have access to:
University info: [universityAboutText]
Course info: [coursePageText]
Offer letter data: [extractedOfferData]
Sample questions: [sampleQuestionsText]
Custom instructions: [customInstructions]
All previous exchanges: [previousExchanges]

Evaluate this answer and return JSON only:
{
  score: number (0-100),
  evaluation: string (2-3 sentences),
  flags: string[] (any concerns),
  inconsistencyDetected: boolean,
  inconsistencyDetail: string,
  followUpNeeded: boolean,
  followUpQuestion: string (if needed),
  autoNextQuestion: string (next question based on conversation flow),
  suggestedRoundEnd: boolean
}`;

function sanitizeScore(score: unknown) {
  const numeric = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric * 100) / 100));
}

function normalizeEvaluation(raw: Partial<AnswerEvaluationResult>): AnswerEvaluationResult {
  return {
    score: sanitizeScore(raw.score),
    evaluation: raw.evaluation?.trim() || "The response was captured and reviewed.",
    flags: Array.isArray(raw.flags) ? raw.flags.filter(Boolean) : [],
    inconsistencyDetected: Boolean(raw.inconsistencyDetected),
    inconsistencyDetail: raw.inconsistencyDetail?.trim() || "",
    followUpNeeded: Boolean(raw.followUpNeeded),
    followUpQuestion: raw.followUpQuestion?.trim() || "",
    autoNextQuestion: raw.autoNextQuestion?.trim() || "Please continue with your next answer.",
    suggestedRoundEnd: Boolean(raw.suggestedRoundEnd),
  };
}

function heuristicEvaluation(input: EvalInput): AnswerEvaluationResult {
  const answer = (input.answer || "").trim();
  const tooShort = answer.split(/\s+/).filter(Boolean).length < 8;
  const flags: string[] = [];

  if (tooShort) flags.push("Answer is too brief and lacks detail.");

  const prior = input.previousExchanges.map((x) => (x.answer || "").toLowerCase()).join(" \n ");
  let inconsistencyDetail = "";
  if (prior && prior.includes("no") && /(yes,|yes\s)/i.test(answer)) {
    inconsistencyDetail = "Potential inconsistency with prior yes/no statements detected.";
    flags.push(inconsistencyDetail);
  }

  const score = tooShort ? 58 : inconsistencyDetail ? 62 : 78;

  return {
    score,
    evaluation: tooShort
      ? "The answer is understandable but lacks sufficient detail to assess confidence and preparedness. Include concrete facts and personal reasoning."
      : "The answer is mostly clear and relevant. Add more specific evidence and examples to strengthen credibility.",
    flags,
    inconsistencyDetected: Boolean(inconsistencyDetail),
    inconsistencyDetail,
    followUpNeeded: tooShort || Boolean(inconsistencyDetail),
    followUpQuestion: tooShort
      ? "Can you provide a more detailed answer with specific facts and an example?"
      : inconsistencyDetail
        ? "Earlier you mentioned a different point. Can you clarify the difference so your responses stay consistent?"
        : "",
    autoNextQuestion: "Thank you. Let’s proceed to the next question.",
    suggestedRoundEnd: false,
  };
}

async function callClaude(input: EvalInput): Promise<AnswerEvaluationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return heuristicEvaluation(input);
  }

  const userPrompt = JSON.stringify(
    {
      universityAboutText: input.universityAboutText || "",
      coursePageText: input.coursePageText || "",
      extractedOfferData: input.extractedOfferData || {},
      sampleQuestionsText: input.sampleQuestionsText || "",
      customInstructions: input.customInstructions || "",
      previousExchanges: input.previousExchanges,
      question: input.question,
      answer: input.answer,
    },
    null,
    2,
  );

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        temperature: 0.2,
        system: EVALUATOR_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      return heuristicEvaluation(input);
    }

    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = payload.content?.find((part) => part.type === "text")?.text || "{}";
    const parsed = JSON.parse(text) as Partial<AnswerEvaluationResult>;
    return normalizeEvaluation(parsed);
  } catch {
    return heuristicEvaluation(input);
  }
}

export async function evaluateMockInterviewAnswer(input: EvalInput): Promise<AnswerEvaluationResult> {
  return callClaude(input);
}

export function calculateOverallWeightedScore(roundScores: Array<{ roundNumber: number; score: number | null }>) {
  let weightedTotal = 0;
  let totalWeight = 0;

  for (const row of roundScores) {
    if (typeof row.score !== "number") continue;
    const weight = ROUND_SCORE_WEIGHTS[row.roundNumber] || 0;
    if (!weight) continue;
    weightedTotal += row.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedTotal / totalWeight) * 100) / 100;
}

export function buildTranscript(
  exchanges: Array<{
    roundNumber: number;
    roundName: string;
    questionNumber: number;
    question: string;
    answer?: string | null;
    score?: number | null;
    isAutoGenerated?: boolean;
    isFollowUp?: boolean;
    flags?: unknown;
  }>,
) {
  return exchanges
    .map((row) => {
      const badges: string[] = [];
      if (row.isAutoGenerated) badges.push("⚡ AUTO");
      if (row.isFollowUp) badges.push("↩ FOLLOW-UP");
      const flags = Array.isArray(row.flags) ? row.flags.join(", ") : "";
      if (flags.toLowerCase().includes("inconsisten")) badges.push("⚠ CHECK");
      const badgeText = badges.length ? ` [${badges.join(" | ")}]` : "";
      return `Round ${row.roundNumber} - ${row.roundName}\nQ${row.questionNumber}${badgeText}: ${row.question}\nA: ${row.answer || "(No answer)"}\nScore: ${typeof row.score === "number" ? row.score : "N/A"}`;
    })
    .join("\n\n");
}

export async function generateMockInterviewReportWithClaude(input: {
  studentName: string;
  interviewType: string;
  passingScore: number;
  overallScore: number;
  roundScores: Array<{ roundNumber: number; roundName: string; score: number | null }>;
  inconsistencies: string[];
  transcript: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const isPassed = input.overallScore >= input.passingScore;

  if (!apiKey) {
    return {
      overallScore: input.overallScore,
      isPassed,
      recommendation: isPassed ? "PASSED" : "NEEDS MORE PREPARATION",
      strengths: isPassed
        ? [
            "Responses were generally clear and structured.",
            "Demonstrated reasonable understanding of course intent.",
            "Maintained acceptable consistency across most rounds.",
          ]
        : ["Motivation for study is present."],
      areasToImprove: [
        "Use more precise factual details (fees, duration, and timelines).",
        "Give stronger home-country tie evidence and post-study plans.",
        "Practice concise but specific answers with examples.",
      ],
      inconsistenciesFound: input.inconsistencies,
      detailedFeedback:
        "This mock interview indicates areas of readiness but also highlights where stronger consistency and evidence-based answers are required. Continue practice with focus on financial clarity, academic rationale, and credible return plans.",
      fullTranscript: input.transcript,
    } satisfies MockInterviewReportPayload;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1400,
        temperature: 0.2,
        system:
          "You are an admissions/visa interview coach. Return strict JSON only with keys: recommendation, strengths (string[]), areasToImprove (string[]), detailedFeedback.",
        messages: [
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
      }),
    });

    if (!response.ok) throw new Error("Claude report generation failed");

    const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = payload.content?.find((x) => x.type === "text")?.text || "{}";
    const parsed = JSON.parse(text) as {
      recommendation?: string;
      strengths?: string[];
      areasToImprove?: string[];
      detailedFeedback?: string;
    };

    return {
      overallScore: input.overallScore,
      isPassed,
      recommendation: parsed.recommendation || (isPassed ? "PASSED" : "NEEDS MORE PREPARATION"),
      strengths: Array.isArray(parsed.strengths) && parsed.strengths.length ? parsed.strengths.slice(0, 3) : ["Demonstrated effort and engagement during interview rounds."],
      areasToImprove:
        Array.isArray(parsed.areasToImprove) && parsed.areasToImprove.length
          ? parsed.areasToImprove.slice(0, 3)
          : ["Provide more specific, evidence-backed responses."],
      inconsistenciesFound: input.inconsistencies,
      detailedFeedback:
        parsed.detailedFeedback ||
        "Overall performance shows potential, but additional focused preparation is advised before a live interview.",
      fullTranscript: input.transcript,
    } satisfies MockInterviewReportPayload;
  } catch {
    return {
      overallScore: input.overallScore,
      isPassed,
      recommendation: isPassed ? "PASSED" : "NEEDS MORE PREPARATION",
      strengths: ["You completed all interview rounds and maintained engagement."],
      areasToImprove: ["Provide more detailed and consistent answers across all topics."],
      inconsistenciesFound: input.inconsistencies,
      detailedFeedback:
        "Your mock interview has been completed. Continue refining factual accuracy, confidence, and consistency before your real interview.",
      fullTranscript: input.transcript,
    } satisfies MockInterviewReportPayload;
  }
}
