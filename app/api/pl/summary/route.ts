import { NextRequest, NextResponse } from "next/server";
import { canViewPL, getPLScope, getPLSummary, parsePLFilters } from "@/lib/pl";

export async function GET(req: NextRequest) {
  const scope = await getPLScope();
  if (!scope || !canViewPL(scope)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filters = parsePLFilters(req.nextUrl.searchParams);
  const data = await getPLSummary(scope, filters);
  return NextResponse.json({ data });
}