import Anthropic from "@anthropic-ai/sdk";

// The one place the CRM's Claude model is chosen. To move to a newer model, change this
// default (or set CLAUDE_MODEL in Vercel) — newer models can change request rules, so test first.
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

export type ClaudeContent = string | Anthropic.Beta.BetaContentBlockParam[];

type ClaudeTextRequest = {
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: ClaudeContent }>;
  /** Thinking counts toward this, so leave room beyond the visible reply. */
  maxTokens?: number;
  /** Opus 5.5 always thinks; effort controls how much (and so latency and cost). */
  effort?: "low" | "medium" | "high";
  /** Short label for logs, e.g. "eduvi-chat". */
  label: string;
};

let client: Anthropic | null = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ maxRetries: 1, timeout: 50_000 });
  return client;
}

export function isClaudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Sends one request and returns the reply text, or null when Claude is unavailable,
 * errors, declines, or runs out of tokens. Callers keep their own fallback behaviour.
 */
export async function claudeText(request: ClaudeTextRequest): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const response = await anthropic.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: request.maxTokens ?? 16_000,
      output_config: { effort: request.effort ?? "low" },
      // A safety-classifier decline is retried on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(request.system ? { system: request.system } : {}),
      messages: request.messages,
    });

    if (response.stop_reason === "refusal") {
      console.warn(`[claude:${request.label}] declined`, response.stop_details?.category ?? null);
      return null;
    }
    if (response.stop_reason === "max_tokens") {
      console.warn(`[claude:${request.label}] hit max_tokens (${request.maxTokens ?? 16_000})`);
    }

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    return text || null;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[claude:${request.label}] API error ${error.status}:`, error.message);
    } else {
      console.error(`[claude:${request.label}] request failed:`, error);
    }
    return null;
  }
}
