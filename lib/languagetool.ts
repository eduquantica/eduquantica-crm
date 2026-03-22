export type GrammarCategory = "GRAMMAR" | "SPELLING" | "STYLE" | "PUNCTUATION" | "OTHER";

export type GrammarIssue = {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  replacements: string[];
  ruleId: string;
  category: GrammarCategory;
  issueType: string;
};

type LanguageToolMatch = {
  message?: string;
  shortMessage?: string;
  offset?: number;
  length?: number;
  replacements?: Array<{ value?: string }>;
  rule?: {
    id?: string;
    issueType?: string;
    category?: {
      id?: string;
      name?: string;
    };
  };
};

type LanguageToolResponse = {
  matches?: LanguageToolMatch[];
};

function normaliseCategory(raw?: string): GrammarCategory {
  const value = (raw || "").toUpperCase();
  if (value.includes("SPELL")) return "SPELLING";
  if (value.includes("PUNCT")) return "PUNCTUATION";
  if (value.includes("STYLE")) return "STYLE";
  if (value.includes("GRAMMAR")) return "GRAMMAR";
  return "OTHER";
}

export async function checkGrammar(text: string, language = "en-GB"): Promise<GrammarIssue[]> {
  const url = process.env.LANGUAGETOOL_URL || "https://api.languagetool.org/v2/check";

  const body = new URLSearchParams({
    text,
    language,
    enabledOnly: "false",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`LanguageTool request failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as LanguageToolResponse;
  const matches = payload.matches || [];

  return matches.map((match) => ({
    message: match.message || "Potential issue",
    shortMessage: match.shortMessage || "Issue",
    offset: match.offset || 0,
    length: match.length || 0,
    replacements: (match.replacements || []).map((item) => item.value || "").filter(Boolean),
    ruleId: match.rule?.id || "unknown",
    category: normaliseCategory(match.rule?.category?.id || match.rule?.category?.name),
    issueType: match.rule?.issueType || "warning",
  }));
}
