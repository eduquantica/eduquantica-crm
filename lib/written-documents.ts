export function countWords(content: string): number {
  return (content || "")
    .replace(/<[^>]*>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function documentTypeToChecklistType(type: "SOP" | "PERSONAL_STATEMENT"): "SOP" | "PERSONAL_STATEMENT" {
  return type === "SOP" ? "SOP" : "PERSONAL_STATEMENT";
}

export function calculateGrammarScore(issueCount: number): number {
  return Math.max(0, Math.min(100, Number((100 - issueCount * 2).toFixed(2))));
}

export function estimateFallbackPlagiarism(content: string): number {
  const text = (content || "").trim();
  if (!text) return 0;

  const lines = text
    .split(/[.!?\n]+/)
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);

  const unique = new Set(lines);
  const repetitionRatio = lines.length ? 1 - unique.size / lines.length : 0;
  return Math.max(0, Math.min(100, Number((repetitionRatio * 100).toFixed(2))));
}

export function estimateFallbackAiScore(content: string): number {
  const text = (content || "").toLowerCase();
  if (!text.trim()) return 0;

  const aiSignals = [
    "in conclusion",
    "delve into",
    "moreover",
    "furthermore",
    "it is important to note",
    "as an ai",
    "ultimately",
  ];

  const signalHits = aiSignals.reduce((sum, signal) => sum + (text.includes(signal) ? 1 : 0), 0);
  const sentenceCount = Math.max(1, text.split(/[.!?]+/).filter(Boolean).length);
  const score = (signalHits / sentenceCount) * 100;
  return Math.max(0, Math.min(100, Number(score.toFixed(2))));
}
