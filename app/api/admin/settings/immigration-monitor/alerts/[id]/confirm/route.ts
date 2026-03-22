import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { publishImmigrationUpdate } from "@/lib/immigration-monitor";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const actor = (session as { user?: { id?: string; roleName?: string } } | null)?.user;
  if (!actor?.id || actor.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await publishImmigrationUpdate(params.id, actor.id);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to publish update" },
      { status: 400 },
    );
  }
}
