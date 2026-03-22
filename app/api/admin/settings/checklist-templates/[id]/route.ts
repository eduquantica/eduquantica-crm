import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const itemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional().nullable(),
  documentType: z.enum([
    "PASSPORT",
    "TRANSCRIPT",
    "DEGREE_CERT",
    "ENGLISH_TEST",
    "SOP",
    "LOR",
    "CV",
    "FINANCIAL_PROOF",
    "PHOTO",
    "VISA_DOCUMENT",
    "PERSONAL_STATEMENT",
    "COVER_LETTER",
    "OTHER",
  ]),
  isRequired: z.boolean(),
  isConditional: z.boolean(),
  conditionRule: z.string().optional().nullable(),
});

const updateSchema = z.object({
  title: z.string().min(1),
  items: z.array(itemSchema),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = updateSchema.parse(await req.json());

    const existing = await db.checklistTemplate.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.checklistTemplate.update({
        where: { id: params.id },
        data: { title: payload.title },
      });

      await tx.checklistTemplateItem.deleteMany({
        where: { templateId: params.id },
      });

      if (payload.items.length > 0) {
        await tx.checklistTemplateItem.createMany({
          data: payload.items.map((item, index) => ({
            templateId: params.id,
            order: index + 1,
            name: item.name,
            description: item.description ?? null,
            documentType: item.documentType,
            isRequired: item.isRequired,
            isConditional: item.isConditional,
            conditionRule: item.conditionRule ?? null,
          })),
        });
      }

      return tx.checklistTemplate.findUniqueOrThrow({
        where: { id: params.id },
        include: {
          items: {
            orderBy: { order: "asc" },
          },
        },
      });
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    console.error("[/api/admin/settings/checklist-templates/[id] PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
