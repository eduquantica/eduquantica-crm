import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkGrammar } from "@/lib/languagetool";
import { calculateGrammarScore } from "@/lib/written-documents";

function groupByCategory(issues: Array<{ category: string }>) {
  return issues.reduce(
    (acc, issue) => {
      const key = issue.category.toLowerCase();
      if (key.includes("spell")) acc.spelling += 1;
      else if (key.includes("grammar")) acc.grammar += 1;
      else if (key.includes("style")) acc.style += 1;
      else if (key.includes("punct")) acc.punctuation += 1;
      else acc.other += 1;
      return acc;
    },
    { spelling: 0, grammar: 0, style: 0, punctuation: 0, other: 0 },
  );
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const document = await db.studentDocument.findFirst({
    where: {
      id: params.id,
      student: { userId: session.user.id },
      OR: [{ scanStatus: null }, { scanStatus: { not: "DELETED" } }],
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const issues = await checkGrammar(document.content, "en-GB");
    const score = calculateGrammarScore(issues.length);
    const summary = groupByCategory(issues);

    await db.studentDocument.update({
      where: { id: document.id },
      data: {
        grammarScore: score,
        grammarCheckedAt: new Date(),
        status: "GRAMMAR_CHECKED",
      },
    });

    return NextResponse.json({
      data: {
        grammarScore: score,
        totalIssues: issues.length,
        summary,
        issues: issues.map((issue) => ({
          offset: issue.offset,
          length: issue.length,
          message: issue.message,
          replacements: issue.replacements,
          ruleId: issue.ruleId,
          category: issue.category,
          shortMessage: issue.shortMessage,
        })),
      },
    });
  } catch (error) {
    console.error("[/api/student/documents/written/[id]/grammar-check POST]", error);
    return NextResponse.json({ error: "Grammar check failed" }, { status: 500 });
  }
}
