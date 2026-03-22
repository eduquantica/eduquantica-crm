import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canManagePLOffices, cleanString, getPLScope } from "@/lib/pl";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getPLScope();
  if (!scope || !canManagePLOffices(scope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const office = await db.pLOffice.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!office) {
    return NextResponse.json({ error: "Office not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const officeName = cleanString(body?.officeName || body?.name);
  const country = cleanString(body?.country);
  const city = cleanString(body?.city);
  const code = cleanString(body?.code);
  const currency = cleanString(body?.currency);
  const subAgentId = cleanString(body?.subAgentId) || null;

  if (subAgentId) {
    const subAgent = await db.subAgent.findUnique({ where: { id: subAgentId }, select: { id: true } });
    if (!subAgent) {
      return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
    }
  }

  const updated = await db.pLOffice.update({
    where: { id: params.id },
    data: {
      ...(officeName ? { officeName } : {}),
      ...(country ? { country } : {}),
      city: city || null,
      code: code || null,
      ...(currency ? { currency } : {}),
      subAgentId,
      ...(typeof body?.isActive === "boolean" ? { isActive: body.isActive } : {}),
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getPLScope();
  if (!scope || !canManagePLOffices(scope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const office = await db.pLOffice.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      _count: {
        select: {
          incomes: true,
          expenses: true,
        },
      },
    },
  });

  if (!office) {
    return NextResponse.json({ error: "Office not found" }, { status: 404 });
  }

  if (office._count.incomes > 0 || office._count.expenses > 0) {
    return NextResponse.json({ error: "Office cannot be deleted while linked records exist" }, { status: 400 });
  }

  await db.pLOffice.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}