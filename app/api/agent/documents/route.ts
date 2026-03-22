import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const DEFAULT_TYPES = [
  "PASSPORT",
  "TRANSCRIPT",
  "DEGREE_CERT",
  "ENGLISH_TEST",
  "SOP",
  "LOR",
  "CV",
  "FINANCIAL_PROOF",
] as const;

type UiStatus = "PENDING" | "SCANNING" | "VERIFIED" | "REVISION_REQUIRED" | "REJECTED";
const SCANNABLE_TYPES = new Set(["SOP", "PERSONAL_STATEMENT", "COVER_LETTER", "LOR"]);

function resolveUiStatus(args: {
  hasDocument: boolean;
  documentStatus?: string | null;
  scanStatus?: string | null;
  counsellorDecision?: string | null;
  itemStatus?: string | null;
}) : UiStatus {
  if (!args.hasDocument) return "PENDING";
  if (args.scanStatus === "SCANNING") return "SCANNING";
  if (args.counsellorDecision === "REVISION_REQUIRED") return "REVISION_REQUIRED";
  if (args.counsellorDecision === "REJECTED" || args.itemStatus === "REJECTED" || args.documentStatus === "REJECTED") {
    return "REJECTED";
  }
  if (args.itemStatus === "VERIFIED" || args.documentStatus === "VERIFIED" || args.counsellorDecision === "ACCEPTED") {
    return "VERIFIED";
  }
  return "PENDING";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "SUB_AGENT" && session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subAgent = await db.subAgent.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!subAgent) {
    return NextResponse.json({ error: "Sub-agent not found" }, { status: 404 });
  }

  const students = await db.student.findMany({
    where: { subAgentId: subAgent.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      documents: {
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          type: true,
          fileName: true,
          fileUrl: true,
          status: true,
          flagColour: true,
          uploadedAt: true,
          scanResult: {
            select: {
              status: true,
              counsellorDecision: true,
              flagColour: true,
              counsellorNote: true,
            },
          },
        },
      },
      documentChecklists: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              label: true,
              documentType: true,
              isRequired: true,
              status: true,
              fraudRiskLevel: true,
              document: {
                select: {
                  id: true,
                  fileName: true,
                  fileUrl: true,
                  status: true,
                  flagColour: true,
                  uploadedAt: true,
                  scanResult: {
                    select: {
                      status: true,
                      counsellorDecision: true,
                      flagColour: true,
                      counsellorNote: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const data = students.map((student) => {
    const checklist = student.documentChecklists[0];

    let items: Array<{
      key: string;
      label: string;
      documentType: string;
      status: UiStatus;
      isScannable: boolean;
      scanStatus: string | null;
      flagColour: string | null;
      counsellorDecision: string | null;
      counsellorNote: string | null;
      documentId: string | null;
      fileName: string | null;
      fileUrl: string | null;
      uploadedAt: string | null;
    }> = [];

    if (checklist?.items?.length) {
      items = checklist.items
        .filter((item) => item.isRequired)
        .map((item) => {
          const status = resolveUiStatus({
            hasDocument: !!item.document,
            documentStatus: item.document?.status,
            scanStatus: item.document?.scanResult?.status,
            counsellorDecision: item.document?.scanResult?.counsellorDecision,
            itemStatus: item.status,
          });

          return {
            key: item.id,
            label: item.label,
            documentType: item.documentType,
            status,
            isScannable: SCANNABLE_TYPES.has(item.documentType),
            scanStatus: item.document?.scanResult?.status || null,
            flagColour: item.document?.scanResult?.flagColour || null,
            counsellorDecision: item.document?.scanResult?.counsellorDecision || null,
            counsellorNote: item.document?.scanResult?.counsellorNote || null,
            documentId: item.document?.id || null,
            fileName: item.document?.fileName || null,
            fileUrl: item.document?.fileUrl || null,
            uploadedAt: item.document?.uploadedAt?.toISOString() || null,
          };
        });
    } else {
      const latestByType = new Map<string, (typeof student.documents)[number]>();
      for (const document of student.documents) {
        if (!latestByType.has(document.type)) {
          latestByType.set(document.type, document);
        }
      }

      items = DEFAULT_TYPES.map((type) => {
        const document = latestByType.get(type) || null;
        const status = resolveUiStatus({
          hasDocument: !!document,
          documentStatus: document?.status,
          scanStatus: document?.scanResult?.status,
          counsellorDecision: document?.scanResult?.counsellorDecision,
        });

        return {
          key: `${student.id}-${type}`,
          label: type.replace(/_/g, " "),
          documentType: type,
          status,
          isScannable: SCANNABLE_TYPES.has(type),
          scanStatus: document?.scanResult?.status || null,
          flagColour: document?.scanResult?.flagColour || null,
          counsellorDecision: document?.scanResult?.counsellorDecision || null,
          counsellorNote: document?.scanResult?.counsellorNote || null,
          documentId: document?.id || null,
          fileName: document?.fileName || null,
          fileUrl: document?.fileUrl || null,
          uploadedAt: document?.uploadedAt?.toISOString() || null,
        };
      });
    }

    const completeCount = items.filter((i) => i.status === "VERIFIED").length;
    const pendingCount = items.filter((i) => i.status === "PENDING" || i.status === "SCANNING").length;
    const flaggedCount = items.filter((i) => i.status === "REVISION_REQUIRED" || i.status === "REJECTED").length;

    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      completeCount,
      pendingCount,
      flaggedCount,
      items,
    };
  });

  return NextResponse.json({ data });
}
