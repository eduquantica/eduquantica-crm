import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { extractTextFromUploadedDocument, runSopFullAnalysis, runSopGrammarAnalysis } from "@/lib/sop-analysis";

type AnalysePayload = {
  mode: "grammar" | "full";
  source:
    | { kind: "text"; text: string }
    | { kind: "upload"; dataUrl: string; fileName: string; mimeType?: string };
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const payload = (await req.json()) as AnalysePayload;
    if (!payload?.mode || !payload?.source?.kind) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    let textToAnalyse = "";

    if (payload.source.kind === "text") {
      textToAnalyse = payload.source.text || "";
    } else {
      textToAnalyse = await extractTextFromUploadedDocument({
        dataUrl: payload.source.dataUrl,
        fileName: payload.source.fileName,
        mimeType: payload.source.mimeType,
      });
    }

    if (!textToAnalyse.trim()) {
      return NextResponse.json({ error: "Could not extract readable text from document." }, { status: 400 });
    }

    if (payload.mode === "grammar") {
      const result = await runSopGrammarAnalysis(textToAnalyse);
      return NextResponse.json({
        data: {
          ...result,
          checkedAt: new Date().toISOString(),
        },
      });
    }

    const result = await runSopFullAnalysis(textToAnalyse);
    return NextResponse.json({
      data: {
        ...result,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[/api/student/sop/analyse POST]", error);
    return NextResponse.json({ error: "Failed to analyse document." }, { status: 500 });
  }
}
