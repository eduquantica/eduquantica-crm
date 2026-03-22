import { NextRequest, NextResponse } from "next/server";
import { detectLanguageCode } from "@/lib/eduvi-engine";

const LANGUAGE_NAMES: Record<string, string> = {
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string };

    if (!body.text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const language = await detectLanguageCode(body.text.trim());

    return NextResponse.json({
      data: {
        language,
        languageName: LANGUAGE_NAMES[language] || language.toUpperCase(),
      },
    });
  } catch (error) {
    console.error("[/api/chat/detect-language POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
