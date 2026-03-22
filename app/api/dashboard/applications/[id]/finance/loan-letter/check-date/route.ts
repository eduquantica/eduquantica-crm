import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";

const payloadSchema = z.object({
  fileUrl: z.string().url(),
});

function canViewFinance(role?: string) {
  return role === "ADMIN"
    || role === "MANAGER"
    || role === "COUNSELLOR"
    || role === "SUB_AGENT"
    || role === "STUDENT"
    || role === "BRANCH_MANAGER"
    || role === "SUB_AGENT_COUNSELLOR";
}

function parseCandidateDate(value: string): Date | null {
  const text = value.trim();
  if (!text) return null;

  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;

  const dmy = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

async function extractLoanLetterDateWithAnthropic(fileUrl: string): Promise<Date | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const fileRes = await fetch(fileUrl, { cache: "no-store" });
  if (!fileRes.ok) return null;

  const mimeType = fileRes.headers.get("content-type") || "application/octet-stream";
  const bytes = Buffer.from(await fileRes.arrayBuffer());
  const base64 = bytes.toString("base64");

  const contentBlocks: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: "Extract the official issue date printed on this education loan approval letter. Return only JSON in this shape: {\"issueDate\": \"YYYY-MM-DD\"} . If no confident date is found, return {\"issueDate\": null}.",
    },
  ];

  if (mimeType.startsWith("image/")) {
    contentBlocks.unshift({
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType,
        data: base64,
      },
    });
  } else {
    contentBlocks.unshift({
      type: "document",
      source: {
        type: "base64",
        media_type: mimeType,
        data: base64,
      },
    });
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
      max_tokens: 220,
      messages: [
        {
          role: "user",
          content: contentBlocks,
        },
      ],
    }),
  });

  if (!response.ok) return null;
  const json = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const text = (json.content || []).find((item) => item.type === "text")?.text || "";

  const parsedJson = (() => {
    const fenced = text.match(/\{[\s\S]*\}/);
    if (!fenced) return null;
    try {
      return JSON.parse(fenced[0]) as { issueDate?: string | null };
    } catch {
      return null;
    }
  })();

  if (parsedJson?.issueDate) {
    return parseCandidateDate(parsedJson.issueDate);
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canViewFinance(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = payloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const issueDate = await extractLoanLetterDateWithAnthropic(parsed.data.fileUrl);
    if (!issueDate) {
      return NextResponse.json({ data: { issueDate: null, daysOld: null, isOlderThanSevenDays: false } });
    }

    const now = new Date();
    const daysOld = Math.floor((now.getTime() - issueDate.getTime()) / (24 * 60 * 60 * 1000));

    return NextResponse.json({
      data: {
        issueDate: issueDate.toISOString().slice(0, 10),
        daysOld,
        isOlderThanSevenDays: daysOld > 7,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/finance/loan-letter/check-date POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
