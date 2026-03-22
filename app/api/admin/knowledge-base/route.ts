import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { seedEduviKnowledgeBaseIfEmpty } from "@/lib/eduvi-knowledge-base";

function isAllowedRole(role?: string) {
  return role === "ADMIN" || role === "MANAGER";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    if (!isAllowedRole(session.user.roleName)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await seedEduviKnowledgeBaseIfEmpty(session.user.id);

    const rows = await db.eduviKnowledgeBase.findMany({
      orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("[/api/admin/knowledge-base GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    if (!isAllowedRole(session.user.roleName)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      title?: string;
      category?: string;
      content?: string;
      tags?: string[];
      isActive?: boolean;
    };

    if (!body.title?.trim() || !body.category?.trim() || !body.content?.trim()) {
      return NextResponse.json({ error: "title, category and content are required" }, { status: 400 });
    }

    const article = await db.eduviKnowledgeBase.create({
      data: {
        title: body.title.trim(),
        category: body.category.trim(),
        content: body.content.trim(),
        tags: (body.tags || []).map((tag) => tag.trim()).filter(Boolean),
        isActive: body.isActive ?? true,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({ data: article }, { status: 201 });
  } catch (error) {
    console.error("[/api/admin/knowledge-base POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
