import { FlagColour, type ScanSettings } from "@prisma/client";

const COPYLEAKS_AUTH_URL = "https://id.copyleaks.com/v3/account/login/api";
const COPYLEAKS_SUBMIT_BASE_URL = "https://api.copyleaks.com/v3/businesses/submit/file";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

let tokenCache: { token: string; expiresAt: number } | null = null;

type CopyleaksAuthResponse = {
  access_token?: string;
  token?: string;
};

export type FlagThresholdSettings = Pick<
  ScanSettings,
  "plagiarismGreenMax" | "plagiarismAmberMax" | "aiGreenMax" | "aiAmberMax"
>;

export async function authenticate(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const email = process.env.COPYLEAKS_EMAIL;
  const key = process.env.COPYLEAKS_API_KEY;

  if (!email || !key) {
    throw new Error("Missing COPYLEAKS_EMAIL or COPYLEAKS_API_KEY");
  }

  const response = await fetch(COPYLEAKS_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, key }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Copyleaks authentication failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as CopyleaksAuthResponse;
  const accessToken = payload.access_token || payload.token;

  if (!accessToken) {
    throw new Error("Copyleaks authentication response missing access token");
  }

  tokenCache = {
    token: accessToken,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };

  return accessToken;
}

export async function submitDocument(scanId: string, text: string, webhookUrl: string): Promise<void> {
  const token = await authenticate();
  const base64Content = Buffer.from(text || "", "utf8").toString("base64");

  const response = await fetch(`${COPYLEAKS_SUBMIT_BASE_URL}/${scanId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      base64: base64Content,
      filename: `${scanId}.txt`,
      properties: {
        webhooks: {
          status: webhookUrl,
        },
      },
    }),
  });

  if (!response.ok) {
    const textBody = await response.text().catch(() => "");
    throw new Error(`Copyleaks submit failed (${response.status}): ${textBody}`);
  }
}

export function calculateFlag(
  plagiarismScore: number | null | undefined,
  aiScore: number | null | undefined,
  settings: FlagThresholdSettings,
): FlagColour {
  const plagiarism = plagiarismScore ?? 0;
  const ai = aiScore ?? 0;

  if (plagiarism > settings.plagiarismAmberMax || ai > settings.aiAmberMax) {
    return FlagColour.RED;
  }

  if (plagiarism > settings.plagiarismGreenMax || ai > settings.aiGreenMax) {
    return FlagColour.AMBER;
  }

  return FlagColour.GREEN;
}

export async function extractTextFromUrl(fileUrl: string): Promise<string> {
  if (!fileUrl) return "";

  const absoluteUrl = fileUrl.startsWith("http://") || fileUrl.startsWith("https://")
    ? fileUrl
    : `${process.env.NEXTAUTH_URL || ""}${fileUrl}`;

  if (!absoluteUrl) return "";

  const response = await fetch(absoluteUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch uploaded file for scan (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("text/") || contentType.includes("json") || contentType.includes("xml")) {
    return await response.text();
  }

  // Best effort fallback for binary files where OCR/text extraction is not yet integrated.
  const buffer = await response.arrayBuffer();
  const preview = Buffer.from(buffer).toString("utf8").slice(0, 20000);
  return preview;
}
