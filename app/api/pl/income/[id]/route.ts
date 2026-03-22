import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  canViewPL,
  cleanString,
  ensureOfficeAccess,
  getPLScope,
} from "@/lib/pl";

function toMoney(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Number(numberValue.toFixed(2));
}

function toDynamicItems(value: unknown) {
  if (!Array.isArray(value)) return null;
  const rows = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const label = cleanString((entry as { label?: unknown }).label);
      const amount = toMoney((entry as { amount?: unknown }).amount);
      if (!label || amount === null || amount <= 0) return null;
      return { label, amount };
    })
    .filter((entry): entry is { label: string; amount: number } => Boolean(entry));
  return rows;
}

async function findRow(scope: Awaited<ReturnType<typeof getPLScope>>, id: string) {
  if (!scope) return null;
  return db.pLIncome.findFirst({
    where: {
      id,
      ...(scope.kind === "agent" ? { agentId: scope.subAgentId } : {}),
    },
    select: {
      id: true,
      isSystemGenerated: true,
      officeId: true,
      agentId: true,
      month: true,
      year: true,
      studentCommission: true,
      applicationFee: true,
      serviceCharge: true,
      otherIncome: true,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getPLScope();
  if (!scope || !canViewPL(scope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (scope.kind !== "admin") {
    return NextResponse.json({ error: "Only admin users can edit income records" }, { status: 403 });
  }

  const existing = await findRow(scope, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Income record not found" }, { status: 404 });
  }
  if (existing.isSystemGenerated) {
    return NextResponse.json({ error: "System generated records cannot be edited" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const updateData: Record<string, unknown> = {};
  const currency = cleanString(body?.currency);
  const officeId = cleanString(body?.officeId);

  if (currency) updateData.currency = currency;

  const studentCommission = body?.studentCommission !== undefined ? toMoney(body.studentCommission) : null;
  const applicationFee = body?.applicationFee !== undefined ? toMoney(body.applicationFee) : null;
  const serviceCharge = body?.serviceCharge !== undefined ? toMoney(body.serviceCharge) : null;
  const otherIncome = body?.otherIncome !== undefined ? toDynamicItems(body.otherIncome) : null;

  if (body?.studentCommission !== undefined && studentCommission === null) {
    return NextResponse.json({ error: "Invalid studentCommission" }, { status: 400 });
  }
  if (body?.applicationFee !== undefined && applicationFee === null) {
    return NextResponse.json({ error: "Invalid applicationFee" }, { status: 400 });
  }
  if (body?.serviceCharge !== undefined && serviceCharge === null) {
    return NextResponse.json({ error: "Invalid serviceCharge" }, { status: 400 });
  }
  if (body?.otherIncome !== undefined && otherIncome === null) {
    return NextResponse.json({ error: "Invalid otherIncome payload" }, { status: 400 });
  }

  const nextStudentCommission = studentCommission ?? existing.studentCommission;
  const nextApplicationFee = applicationFee ?? existing.applicationFee;
  const nextServiceCharge = serviceCharge ?? existing.serviceCharge;
  const nextOtherIncome = otherIncome ?? ((existing.otherIncome as unknown[]) || []);
  const otherIncomeTotal = (nextOtherIncome as unknown[]).reduce<number>((sum, row) => {
    const amount = typeof row === "object" && row && "amount" in row ? Number((row as { amount?: unknown }).amount) : 0;
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const totalIncome = Number((nextStudentCommission + nextApplicationFee + nextServiceCharge + otherIncomeTotal).toFixed(2));

  updateData.studentCommission = nextStudentCommission;
  updateData.applicationFee = nextApplicationFee;
  updateData.serviceCharge = nextServiceCharge;
  updateData.otherIncome = nextOtherIncome;
  updateData.totalIncome = totalIncome;
  updateData.amount = totalIncome;
  updateData.source = "MONTHLY_STATEMENT";

  if (typeof body?.officeId === "string") {
    if (officeId) {
      const office = await ensureOfficeAccess(scope, officeId);
      if (!office) {
        return NextResponse.json({ error: "Office not found" }, { status: 404 });
      }
      updateData.officeId = office.id;
    } else {
      updateData.officeId = null;
    }
  }

  const month = Number(body?.month);
  const year = Number(body?.year);
  const targetMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : existing.month;
  const targetYear = Number.isInteger(year) && year > 2000 ? year : existing.year;
  updateData.month = targetMonth;
  updateData.year = targetYear;

  const nextOfficeId = (updateData.officeId as string | null | undefined) ?? existing.officeId;
  const nextAgentId = existing.agentId;
  updateData.periodKey = `${nextOfficeId || "global"}:${nextAgentId || "global"}:${targetYear}:${targetMonth}`;
  updateData.receivedDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));

  const updated = await db.pLIncome.update({
    where: { id: params.id },
    data: updateData,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getPLScope();
  if (!scope || !canViewPL(scope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (scope.kind !== "admin") {
    return NextResponse.json({ error: "Only admin users can delete income records" }, { status: 403 });
  }

  const existing = await findRow(scope, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Income record not found" }, { status: 404 });
  }
  if (existing.isSystemGenerated) {
    return NextResponse.json({ error: "System generated records cannot be deleted" }, { status: 400 });
  }

  await db.pLIncome.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}