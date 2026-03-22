import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_DELETE_ROLES = new Set(["ADMIN", "MANAGER", "SUB_AGENT", "BRANCH_MANAGER"]);

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; documentId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const doc = await db.applicationDocument.findFirst({
    where: {
      id: params.documentId,
      applicationId: params.id,
    },
    select: {
      id: true,
      uploadedById: true,
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const canDeleteAny = ADMIN_DELETE_ROLES.has(session.user.roleName);
  const canDeleteOwn = doc.uploadedById === session.user.id;

  if (!canDeleteAny && !canDeleteOwn) {
    return NextResponse.json({ error: "You can only delete your own uploads" }, { status: 403 });
  }

  await db.applicationDocument.delete({ where: { id: doc.id } });
  return NextResponse.json({ ok: true });
}
