import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canManagePLOffices, canViewPL, cleanString, getAccessibleOfficeFilter, getPLScope } from "@/lib/pl";

export async function GET(req: NextRequest) {
  const scope = await getPLScope();
  if (!scope || !canViewPL(scope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = cleanString(req.nextUrl.searchParams.get("search"));
  const country = cleanString(req.nextUrl.searchParams.get("country"));
  const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "true";

  const offices = await db.pLOffice.findMany({
    where: {
      ...getAccessibleOfficeFilter(scope),
      ...(country ? { country: { equals: country, mode: "insensitive" } } : {}),
      ...(activeOnly ? { isActive: true } : {}),
      ...(search
        ? {
            OR: [
              { officeName: { contains: search, mode: "insensitive" } },
              { country: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      officeName: true,
      country: true,
      city: true,
      code: true,
      currency: true,
      isActive: true,
      subAgentId: true,
      createdAt: true,
      _count: {
        select: {
          incomes: true,
          expenses: true,
        },
      },
    },
    orderBy: [{ country: "asc" }, { officeName: "asc" }],
  });

  return NextResponse.json({
    data: offices.map((office) => ({
      ...office,
      name: office.officeName,
    })),
  });
}

export async function POST(req: NextRequest) {
  const scope = await getPLScope();
  if (!scope || !canManagePLOffices(scope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const officeName = cleanString(body?.officeName || body?.name);
  const country = cleanString(body?.country);
  const city = cleanString(body?.city);
  const code = cleanString(body?.code);
  const currency = cleanString(body?.currency) || "GBP";
  const subAgentId = cleanString(body?.subAgentId) || null;

  if (!officeName || !country) {
    return NextResponse.json({ error: "Name and country are required" }, { status: 400 });
  }

  if (subAgentId) {
    const subAgent = await db.subAgent.findUnique({ where: { id: subAgentId }, select: { id: true } });
    if (!subAgent) {
      return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
    }
  }

  const office = await db.pLOffice.create({
    data: {
      officeName,
      country,
      city: city || null,
      code: code || null,
      currency,
      subAgentId,
      isActive: body?.isActive === false ? false : true,
    },
  });

  return NextResponse.json({ data: office }, { status: 201 });
}