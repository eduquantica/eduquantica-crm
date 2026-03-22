import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getAgentScope } from "@/lib/agent-scope";

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const parsed = parseInt(normalized, 16);
  return {
    r: ((parsed >> 16) & 255) / 255,
    g: ((parsed >> 8) & 255) / 255,
    b: (parsed & 255) / 255,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.roleName === "ADMIN";
  const allowedAgentRoles = ["SUB_AGENT", "BRANCH_MANAGER"];
  if (!isAdmin && !allowedAgentRoles.includes(session.user.roleName)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let subAgentId: string | null = null;
  if (isAdmin) {
    const byUser = await db.subAgent.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    subAgentId = byUser?.id || null;
  } else {
    const scope = await getAgentScope();
    subAgentId = scope?.subAgentId || null;
  }

  if (!subAgentId) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const subAgent = await db.subAgent.findUnique({
    where: { id: subAgentId },
    select: {
      id: true,
      agencyName: true,
      brandingPrimaryColor: true,
      brandingContactEmail: true,
      brandingContactPhone: true,
      brandingWebsite: true,
      agreement: { select: { currentTier: true } },
    },
  });

  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const tierLabel =
    subAgent.agreement?.currentTier === "SILVER"
      ? "SILVER"
      : subAgent.agreement?.currentTier === "PLATINUM"
      ? "PLATINUM"
      : "GOLD";

  const material = await db.marketingMaterial.findFirst({
    where: {
      id: params.id,
      isActive: true,
      availableTiers: { has: tierLabel },
      OR: [{ subAgentOwnerId: null }, { subAgentOwnerId: subAgent.id }],
    },
    select: {
      id: true,
      name: true,
      fileUrl: true,
      type: true,
    },
  });

  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  const isPdf = material.fileUrl.toLowerCase().includes(".pdf");
  if (!isPdf) {
    return NextResponse.json({
      data: {
        mode: "image",
        material,
        previewOverlay: {
          agencyName: subAgent.agencyName,
          primaryColor: subAgent.brandingPrimaryColor || "#2563EB",
          footer: `${subAgent.brandingContactEmail || ""} ${subAgent.brandingContactPhone || ""} ${subAgent.brandingWebsite || ""}`.trim(),
        },
      },
    });
  }

  const doc = await PDFDocument.create();
  const page = doc.addPage([800, 1100]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const color = hexToRgb(subAgent.brandingPrimaryColor || "#2563EB");

  page.drawRectangle({ x: 0, y: 1060, width: 800, height: 40, color: rgb(color.r, color.g, color.b) });
  page.drawText(`Preview: ${material.name}`, { x: 24, y: 1074, size: 12, color: rgb(1, 1, 1), font });
  page.drawText(subAgent.agencyName || "Your Agency", { x: 24, y: 1028, size: 18, color: rgb(color.r, color.g, color.b), font });
  page.drawText(`Source file: ${material.fileUrl}`, { x: 24, y: 990, size: 10, color: rgb(0.2, 0.2, 0.2), font });

  const footer = [subAgent.brandingContactEmail, subAgent.brandingContactPhone, subAgent.brandingWebsite]
    .filter(Boolean)
    .join(" • ");
  if (footer) {
    page.drawRectangle({ x: 0, y: 0, width: 800, height: 36, color: rgb(color.r, color.g, color.b) });
    page.drawText(footer, { x: 24, y: 12, size: 10, color: rgb(1, 1, 1), font });
  }

  const bytes = await doc.save();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=preview-${material.id}.pdf`,
    },
  });
}
