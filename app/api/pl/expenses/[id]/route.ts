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
  return db.pLExpense.findFirst({
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
      rent: true,
      salaries: true,
      marketing: true,
      operations: true,
      legal: true,
      travel: true,
      otherExpenses: true,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getPLScope();
  if (!scope || !canViewPL(scope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await findRow(scope, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Expense record not found" }, { status: 404 });
  }
  if (existing.isSystemGenerated) {
    return NextResponse.json({ error: "System generated records cannot be edited" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const updateData: Record<string, unknown> = {};
  const currency = cleanString(body?.currency);
  const officeId = cleanString(body?.officeId);

  if (currency) updateData.currency = currency;

  const rent = body?.rent !== undefined ? toMoney(body.rent) : null;
  const salaries = body?.salaries !== undefined ? toMoney(body.salaries) : null;
  const marketing = body?.marketing !== undefined ? toMoney(body.marketing) : null;
  const operations = body?.operations !== undefined ? toMoney(body.operations) : null;
  const legal = body?.legal !== undefined ? toMoney(body.legal) : null;
  const travel = body?.travel !== undefined ? toMoney(body.travel) : null;
  const otherExpenses = body?.otherExpenses !== undefined ? toDynamicItems(body.otherExpenses) : null;

  if (body?.rent !== undefined && rent === null) return NextResponse.json({ error: "Invalid rent" }, { status: 400 });
  if (body?.salaries !== undefined && salaries === null) return NextResponse.json({ error: "Invalid salaries" }, { status: 400 });
  if (body?.marketing !== undefined && marketing === null) return NextResponse.json({ error: "Invalid marketing" }, { status: 400 });
  if (body?.operations !== undefined && operations === null) return NextResponse.json({ error: "Invalid operations" }, { status: 400 });
  if (body?.legal !== undefined && legal === null) return NextResponse.json({ error: "Invalid legal" }, { status: 400 });
  if (body?.travel !== undefined && travel === null) return NextResponse.json({ error: "Invalid travel" }, { status: 400 });
  if (body?.otherExpenses !== undefined && otherExpenses === null) {
    return NextResponse.json({ error: "Invalid otherExpenses payload" }, { status: 400 });
  }

  const nextRent = rent ?? existing.rent;
  const nextSalaries = salaries ?? existing.salaries;
  const nextMarketing = marketing ?? existing.marketing;
  const nextOperations = operations ?? existing.operations;
  const nextLegal = legal ?? existing.legal;
  const nextTravel = travel ?? existing.travel;
  const nextOtherExpenses = otherExpenses ?? ((existing.otherExpenses as unknown[]) || []);
  const otherExpensesTotal = (nextOtherExpenses as unknown[]).reduce<number>((sum, row) => {
    const amount = typeof row === "object" && row && "amount" in row ? Number((row as { amount?: unknown }).amount) : 0;
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const totalExpenses = Number(
    (nextRent + nextSalaries + nextMarketing + nextOperations + nextLegal + nextTravel + otherExpensesTotal).toFixed(2),
  );

  updateData.rent = nextRent;
  updateData.salaries = nextSalaries;
  updateData.marketing = nextMarketing;
  updateData.operations = nextOperations;
  updateData.legal = nextLegal;
  updateData.travel = nextTravel;
  updateData.otherExpenses = nextOtherExpenses;
  updateData.totalExpenses = totalExpenses;
  updateData.amount = totalExpenses;
  updateData.expenseType = "MONTHLY_STATEMENT";
  updateData.isCostOfSale = false;

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
  updateData.incurredDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));

  const updated = await db.pLExpense.update({
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

  const existing = await findRow(scope, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Expense record not found" }, { status: 404 });
  }
  if (existing.isSystemGenerated) {
    return NextResponse.json({ error: "System generated records cannot be deleted" }, { status: 400 });
  }

  await db.pLExpense.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}