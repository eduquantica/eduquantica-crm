import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { extractTextFromFileUrl } from "@/lib/sop-analysis";

type ExtractPayload = {
  fileUrl?: string;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const payload = (await req.json()) as ExtractPayload;
    const fileUrl = String(payload.fileUrl || "").trim();

    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl is required." }, { status: 400 });
    }

    const text = await extractTextFromFileUrl(fileUrl);

    if (!text.trim()) {
      return NextResponse.json({ error: "Could not extract readable text from this file." }, { status: 400 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("[/api/sop/extract-text POST]", error);
    return NextResponse.json({ error: "Failed to extract text." }, { status: 500 });
  }
}
