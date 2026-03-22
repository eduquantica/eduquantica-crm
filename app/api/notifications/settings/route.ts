import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NotificationService } from "@/lib/notifications";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const data = await NotificationService.getChannelSettings(session.user.id);
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({} as { portal?: boolean; email?: boolean; sms?: boolean }));
  const data = await NotificationService.updateChannelSettings(session.user.id, payload);

  return NextResponse.json({ data });
}
