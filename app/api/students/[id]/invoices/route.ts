import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoices = await db.studentInvoice.findMany({
      where: { studentId: params.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: invoices });
  } catch (error) {
    console.error("[GET /api/students/[id]/invoices]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to create invoices
    const role = session.user.roleName;
    if (!["ADMIN", "MANAGER", "COUNSELLOR", "SUB_AGENT", "BRANCH_MANAGER", "SUB_AGENT_COUNSELLOR"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      fileOpeningCharge,
      serviceCharge,
      serviceChargeType,
      serviceInstalment1,
      serviceInstalment1Desc,
      serviceInstalment2,
      serviceInstalment2Desc,
      ucasFee,
      applicationFee,
      applicationFeeDesc,
      applicationFee2,
      applicationFee2Desc,
      airportPickupFee,
      airportPickupDesc,
      otherDescription,
      otherAmount,
      currency,
      paymentMethod,
      notes,
    } = body;

    // Calculate total
    let totalAmount = 0;
    if (fileOpeningCharge) totalAmount += fileOpeningCharge;
    if (serviceCharge) totalAmount += serviceCharge;
    if (serviceInstalment1) totalAmount += serviceInstalment1;
    if (serviceInstalment2) totalAmount += serviceInstalment2;
    if (ucasFee) totalAmount += ucasFee;
    if (applicationFee) totalAmount += applicationFee;
    if (applicationFee2) totalAmount += applicationFee2;
    if (airportPickupFee) totalAmount += airportPickupFee;
    if (otherAmount) totalAmount += otherAmount;

    // Generate invoice number: INV-[year]-[random4digits]
    const year = new Date().getFullYear();
    const randomPart = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    const invoiceNumber = `INV-${year}-${randomPart}`;

    const invoice = await db.studentInvoice.create({
      data: {
        studentId: params.id,
        invoiceNumber,
        fileOpeningCharge: fileOpeningCharge || null,
        serviceCharge: serviceCharge || null,
        serviceChargeType: serviceChargeType || null,
        serviceInstalment1: serviceInstalment1 || null,
        serviceInstalment1Desc: serviceInstalment1Desc || null,
        serviceInstalment2: serviceInstalment2 || null,
        serviceInstalment2Desc: serviceInstalment2Desc || null,
        ucasFee: ucasFee || null,
        applicationFee: applicationFee || null,
        applicationFeeDesc: applicationFeeDesc || null,
        applicationFee2: applicationFee2 || null,
        applicationFee2Desc: applicationFee2Desc || null,
        airportPickupFee: airportPickupFee || null,
        airportPickupDesc: airportPickupDesc || null,
        otherDescription: otherDescription || null,
        otherAmount: otherAmount || null,
        totalAmount,
        currency: currency || "GBP",
        paymentMethod: paymentMethod || null,
        notes: notes || null,
        status: "DUE",
        createdBy: session.user.id,
        createdByRole: role,
        createdByName: session.user.name || session.user.email || "Unknown",
      },
    });

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/students/[id]/invoices]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
