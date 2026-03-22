import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function isAllowedRole(role?: string) {
  return role === "ADMIN" || role === "MANAGER";
}

type RouteParams = {
  params: {
    id: string;
  };
};

export async function PUT(req: NextRequest, { params }: RouteParams) {
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

    const updated = await db.eduviKnowledgeBase.update({
      where: { id: params.id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.category !== undefined ? { category: body.category.trim() } : {}),
        ...(body.content !== undefined ? { content: body.content.trim() } : {}),
        ...(body.tags !== undefined ? { tags: body.tags.map((tag) => tag.trim()).filter(Boolean) } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[/api/admin/knowledge-base/[id] PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    if (!isAllowedRole(session.user.roleName)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await db.eduviKnowledgeBase.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[/api/admin/knowledge-base/[id] DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
