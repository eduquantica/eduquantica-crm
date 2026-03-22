import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const certificate = await db.verifiedCertificate.findUnique({
      where: { publicToken: params.token },
      select: {
        reference: true,
        studentName: true,
        universityName: true,
        courseName: true,
        destinationCountry: true,
        issuedAt: true,
        pdfUrl: true,
      },
    });

    if (!certificate) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }

    return NextResponse.json({ data: certificate });
  } catch (error) {
    console.error("[/api/public/certificates/[token] GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
