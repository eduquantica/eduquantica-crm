import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DEFAULT_FINANCIAL_REQUIREMENTS,
  normalizeCountryCode,
  parseDurationMonths,
  resolveFinancialRequirement,
  type FinancialRequirementRule,
} from "@/lib/financial-requirements";
import { readLatestAction, type DepositExtracted, type OfferLetterExtracted } from "@/lib/application-finance";
import { resolveChecklistUiStatus } from "@/lib/checklist-portal";
import { triggerFinanceComplete, triggerFinanceInProgressFromFunding } from "@/lib/application-status-triggers";

function canViewFinance(role?: string) {
  return role === "ADMIN" || role === "MANAGER" || role === "COUNSELLOR" || role === "SUB_AGENT" || role === "STUDENT" || role === "BRANCH_MANAGER" || role === "SUB_AGENT_COUNSELLOR";
}

function canApproveDeposit(role?: string) {
  return role === "ADMIN" || role === "MANAGER" || role === "COUNSELLOR";
}

function canManageFunding(role?: string) {
  return role === "ADMIN" || role === "MANAGER" || role === "COUNSELLOR" || role === "SUB_AGENT" || role === "STUDENT" || role === "BRANCH_MANAGER" || role === "SUB_AGENT_COUNSELLOR";
}

function canViewBankStatementDetails(role?: string) {
  return role === "ADMIN" || role === "MANAGER" || role === "SUB_AGENT" || role === "BRANCH_MANAGER" || role === "SUB_AGENT_COUNSELLOR";
}

const fundingSourceEnum = z.enum([
  "SPONSORSHIP",
  "UNIVERSITY_SCHOLARSHIP",
  "EDUCATION_LOAN",
  "PERSONAL_FUNDS",
  "OTHER",
]);

const fundingAccountSchema = z.object({
  accountType: z.enum(["STANDARD", "TERM_DEPOSIT", "SAVINGS", "INVESTMENT", "PENSION", "OTHER"]),
  accountOwner: z.enum(["MY_OWN", "SOMEONE_ELSE", "JOINT"]),
  country: z.string().min(2),
  bankName: z.string().min(2),
  customBankName: z.string().nullable().optional(),
  accountCurrency: z.string().length(3),
  totalAmount: z.number().min(0),
  allocatedAmount: z.number().min(0),
  accessibleImmediately: z.boolean(),
});

const fundingPayloadSchema = z.object({
  selectedSources: z.array(fundingSourceEnum).min(1),
  loan: z
    .object({
      providerName: z.string().min(2),
      amountGbp: z.number().min(0),
      approvalDate: z.string().min(4),
      approvalLetterFileName: z.string().min(1),
      approvalLetterFileUrl: z.string().min(1),
    })
    .nullable()
    .optional(),
  personalFunds: z
    .object({
      accounts: z.array(fundingAccountSchema),
      accountMeta: z.array(
        z.object({
          accountHolderName: z.string().optional(),
          ownershipType: z.enum(["MY_PARENTS", "MY_SPONSOR", "MY_LOAN_PROVIDER", "OTHER_FAMILY_MEMBER", "OTHER"]).optional(),
          ownershipOtherText: z.string().nullable().optional(),
        }),
      ).optional(),
    })
    .nullable()
    .optional(),
  sponsorship: z
    .object({
      sponsorshipType: z.enum(["COMPANY", "GOVERNMENT", "UNIVERSITY", "THIRD_PARTY_ORGANISATION"]).nullable().optional(),
    })
    .nullable()
    .optional(),
  otherExplanation: z.string().nullable().optional(),
});

type ApprovedDeposit = {
  approvedAt: string;
  approvedBy: string;
  amountPaid: number | null;
  checklistItemId: string | null;
  documentId: string;
};

type UploadedBankStatement = {
  documentId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  accountRef: {
    accountOwner: "MY_OWN" | "SOMEONE_ELSE" | "JOINT";
    country: string;
    bankName: string;
    accountCurrency: string;
  };
  extracted: {
    accountHolderName: string;
    bankName: string;
    accountNumberMasked: string;
    statementDate: string | null;
    closingBalance: number | null;
    openingBalance: number | null;
    currency: string | null;
    transactions: Array<{
      date: string;
      description: string;
      amount: number;
    }>;
  };
  checks: unknown;
  outcome: "GREEN" | "AMBER" | "RED";
  message: string;
};

type ApprovedBankStatement = {
  approvedAt: string;
  approvedBy: string;
  documentId: string;
  checklistItemId: string;
  outcome: "GREEN" | "AMBER" | "RED" | null;
};

type CountrySpecificDocumentKey = "PASSPORT" | "ACADEMIC" | "ENGLISH_TEST" | "TB_TEST" | "POST_STUDY_PLAN" | "BANK_STATEMENT";

type FinanceGeneralDocumentUpload = {
  key: string;
  documentId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  context?: {
    accountIndex?: number;
    sponsorType?: string;
    ownershipType?: string;
    customLabel?: string;
  } | null;
  reviewStatus: "PENDING" | "VERIFIED" | "REJECTED";
  reviewedAt: string | null;
  reviewedBy: string | null;
};

const TB_REQUIRED_NATIONALITIES = new Set(["BD", "PK", "IN", "NG", "GH", "ET", "PH", "VN"]);

function normalizeNationalityCode(value?: string | null): string {
  if (!value) return "";
  const input = value.trim().toUpperCase();
  const map: Record<string, string> = {
    BANGLADESH: "BD",
    PAKISTAN: "PK",
    INDIA: "IN",
    NIGERIA: "NG",
    GHANA: "GH",
    ETHIOPIA: "ET",
    PHILIPPINES: "PH",
    VIETNAM: "VN",
    UK: "UK",
    "UNITED KINGDOM": "UK",
    "GREAT BRITAIN": "UK",
    CANADA: "CA",
    AUSTRALIA: "AU",
  };

  if (map[input]) return map[input];
  if (/^[A-Z]{2}$/.test(input)) return input;
  return input;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canViewFinance(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const application = await db.application.findUnique({
      where: { id: params.id },
      include: {
        student: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            nationality: true,
            assignedCounsellorId: true,
            subAgent: { select: { userId: true } },
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            duration: true,
            tuitionFee: true,
            currency: true,
            level: true,
          },
        },
        university: {
          select: {
            country: true,
          },
        },
        scholarshipApps: {
          where: {
            OR: [{ applicationId: params.id }, { applicationId: null }],
          },
          include: {
            scholarship: {
              select: {
                amount: true,
                currency: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (
      session.user.roleName === "COUNSELLOR" &&
      application.student.assignedCounsellorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      session.user.roleName === "SUB_AGENT" &&
      application.student.subAgent?.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.roleName === "STUDENT" && application.student.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const offerUpload = await readLatestAction<{
      documentId: string;
      fileName: string;
      fileUrl: string;
      ocr: OfferLetterExtracted;
      uploadedAt: string;
    }>(params.id, "offer_letter_uploaded");

    const depositUpload = await readLatestAction<{
      documentId: string;
      fileName: string;
      fileUrl: string;
      ocr: DepositExtracted;
      uploadedAt: string;
    }>(params.id, "deposit_receipt_uploaded");

    const depositApprovalLogs = await db.activityLog.findMany({
      where: {
        entityType: "application",
        entityId: params.id,
        action: "deposit_receipt_approved",
      },
      orderBy: { createdAt: "asc" },
      select: { details: true },
    });

    const approvedDeposits: ApprovedDeposit[] = [];
    for (const row of depositApprovalLogs) {
      if (!row.details) continue;
      try {
        const parsed = JSON.parse(row.details) as ApprovedDeposit;
        approvedDeposits.push({
          approvedAt: parsed.approvedAt,
          approvedBy: parsed.approvedBy,
          amountPaid: parsed.amountPaid ?? null,
          checklistItemId: parsed.checklistItemId ?? null,
          documentId: parsed.documentId,
        });
      } catch {
        continue;
      }
    }

    const latestDepositApproval = approvedDeposits.length
      ? approvedDeposits[approvedDeposits.length - 1]
      : null;

    const uploadedBankLogs = await db.activityLog.findMany({
      where: {
        entityType: "application",
        entityId: params.id,
        action: "bank_statement_uploaded",
      },
      orderBy: { createdAt: "desc" },
      select: { details: true },
    });

    const approvedBankLogs = await db.activityLog.findMany({
      where: {
        entityType: "application",
        entityId: params.id,
        action: "bank_statement_approved",
      },
      orderBy: { createdAt: "desc" },
      select: { details: true },
    });

    const approvedByDocId = new Map<string, ApprovedBankStatement>();
    for (const row of approvedBankLogs) {
      if (!row.details) continue;
      try {
        const parsed = JSON.parse(row.details) as ApprovedBankStatement;
        if (parsed.documentId && !approvedByDocId.has(parsed.documentId)) {
          approvedByDocId.set(parsed.documentId, parsed);
        }
      } catch {
        continue;
      }
    }

    const bankStatements = uploadedBankLogs
      .map((row) => {
        if (!row.details) return null;
        try {
          return JSON.parse(row.details) as UploadedBankStatement;
        } catch {
          return null;
        }
      })
      .filter((item): item is UploadedBankStatement => Boolean(item))
      .map((item) => {
        const approved = approvedByDocId.get(item.documentId) || null;
        const base = {
          documentId: item.documentId,
          fileName: item.fileName,
          fileUrl: item.fileUrl,
          uploadedAt: item.uploadedAt,
          accountRef: item.accountRef,
          outcome: item.outcome,
          message: item.message,
          approved,
        };

        if (canViewBankStatementDetails(session.user.roleName)) {
          return {
            ...base,
            extracted: item.extracted,
            checks: item.checks,
          };
        }

        return {
          ...base,
          extracted: {
            accountNumberMasked: item.extracted.accountNumberMasked,
            bankName: item.extracted.bankName,
            statementDate: item.extracted.statementDate,
            closingBalance: item.extracted.closingBalance,
            currency: item.extracted.currency,
          },
        };
      });

    const checklist = await db.documentChecklist.findFirst({
      where: { applicationId: params.id },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            document: {
              include: {
                scanResult: {
                  select: {
                    status: true,
                    counsellorDecision: true,
                    counsellorNote: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const checklistItems = checklist?.items || [];
    const findItemByType = (types: string[]) =>
      checklistItems.find((item) => types.includes(item.documentType));

    const findVerifiedByType = (types: string[]) => {
      const found = checklistItems.find((item) => {
        if (!types.includes(item.documentType)) return false;
        return resolveChecklistUiStatus(item).status === "VERIFIED";
      });
      return Boolean(found);
    };

    const passportItem = findItemByType(["PASSPORT"]);
    const academicItem = findItemByType(["TRANSCRIPT", "DEGREE_CERT"]);
    const englishItem = findItemByType(["ENGLISH_TEST"]);
    const tbItem = checklistItems.find(
      (item) =>
        item.documentType === "VISA_DOCUMENT"
        && (item.label.toLowerCase().includes("tb") || item.label.toLowerCase().includes("tuberculosis")),
    );
    const postStudyItem = findItemByType(["PERSONAL_STATEMENT", "SOP", "COVER_LETTER"]);

    const countryCodeForDocs = normalizeCountryCode(application.university.country);
    const nationalityCode = normalizeNationalityCode(application.student.nationality);
    const tbRequired = countryCodeForDocs === "UK" && TB_REQUIRED_NATIONALITIES.has(nationalityCode);
    const bankStatementDone = bankStatements.some((item) => Boolean(item.approved));

    const countrySpecificDocuments: Array<{
      key: CountrySpecificDocumentKey;
      label: string;
      status: "DONE" | "TODO";
      required: boolean;
      checklistItemId: string | null;
      uploadDocumentType: string | null;
    }> = [
      {
        key: "PASSPORT",
        label: "Current valid passport",
        status: findVerifiedByType(["PASSPORT"]) ? "DONE" : "TODO",
        required: true,
        checklistItemId: passportItem?.id || null,
        uploadDocumentType: "PASSPORT",
      },
      {
        key: "ACADEMIC",
        label: "Academic transcripts and certificates",
        status: findVerifiedByType(["TRANSCRIPT", "DEGREE_CERT"]) ? "DONE" : "TODO",
        required: true,
        checklistItemId: academicItem?.id || null,
        uploadDocumentType: "TRANSCRIPT",
      },
      {
        key: "ENGLISH_TEST",
        label: "English test results",
        status: findVerifiedByType(["ENGLISH_TEST"]) ? "DONE" : "TODO",
        required: true,
        checklistItemId: englishItem?.id || null,
        uploadDocumentType: "ENGLISH_TEST",
      },
      {
        key: "TB_TEST",
        label: "TB test certificate",
        status: !tbRequired || (tbItem ? resolveChecklistUiStatus(tbItem).status === "VERIFIED" : false) ? "DONE" : "TODO",
        required: tbRequired,
        checklistItemId: tbItem?.id || null,
        uploadDocumentType: "VISA_DOCUMENT",
      },
      {
        key: "POST_STUDY_PLAN",
        label: "Personal Post-Study Plans Letter",
        status: findVerifiedByType(["PERSONAL_STATEMENT", "SOP", "COVER_LETTER"]) ? "DONE" : "TODO",
        required: true,
        checklistItemId: postStudyItem?.id || null,
        uploadDocumentType: "PERSONAL_STATEMENT",
      },
      {
        key: "BANK_STATEMENT",
        label: "Bank statements",
        status: bankStatementDone ? "DONE" : "TODO",
        required: true,
        checklistItemId: null,
        uploadDocumentType: "FINANCIAL_PROOF",
      },
    ];

    const fundingConfig = await readLatestAction<{
      selectedSources: Array<z.infer<typeof fundingSourceEnum>>;
      loan?: {
        providerName: string;
        amountGbp: number;
        approvalDate: string;
        approvalLetterFileName: string;
        approvalLetterFileUrl: string;
      } | null;
      personalFunds?: {
        accounts: Array<z.infer<typeof fundingAccountSchema>>;
        accountMeta?: Array<{
          accountHolderName?: string;
          ownershipType?: "MY_PARENTS" | "MY_SPONSOR" | "MY_LOAN_PROVIDER" | "OTHER_FAMILY_MEMBER" | "OTHER";
          ownershipOtherText?: string | null;
        }>;
      } | null;
      sponsorship?: {
        sponsorshipType?: "COMPANY" | "GOVERNMENT" | "UNIVERSITY" | "THIRD_PARTY_ORGANISATION" | null;
      } | null;
      otherExplanation?: string | null;
      updatedAt: string;
    }>(params.id, "funding_sources_updated");

    const countryCode = normalizeCountryCode(application.university.country);

    const latestSourceOfFundsLog = await db.activityLog.findFirst({
      where: {
        entityType: "application",
        entityId: params.id,
        action: "finance_general_document_uploaded",
      },
      orderBy: { createdAt: "desc" },
      select: { details: true },
    });

    let hasSourceOfFundsDocument = false;
    if (latestSourceOfFundsLog?.details) {
      try {
        const parsed = JSON.parse(latestSourceOfFundsLog.details) as { key?: string };
        hasSourceOfFundsDocument = parsed.key === "SOURCE_OF_FUNDS";
      } catch {
        hasSourceOfFundsDocument = false;
      }
    }

    const allGeneralDocumentLogs = await db.activityLog.findMany({
      where: {
        entityType: "application",
        entityId: params.id,
        action: "finance_general_document_uploaded",
      },
      orderBy: { createdAt: "desc" },
      select: { details: true },
    });

    const reviewLogs = await db.activityLog.findMany({
      where: {
        entityType: "application",
        entityId: params.id,
        action: "finance_general_document_reviewed",
      },
      orderBy: { createdAt: "desc" },
      select: { details: true },
    });

    const reviewByDocument = new Map<string, { status: "VERIFIED" | "REJECTED"; reviewedAt: string; reviewedBy: string | null }>();
    for (const row of reviewLogs) {
      if (!row.details) continue;
      try {
        const parsed = JSON.parse(row.details) as {
          documentId?: string;
          status?: "VERIFIED" | "REJECTED";
          reviewedAt?: string;
          reviewedBy?: string | null;
        };
        if (!parsed.documentId || !parsed.status) continue;
        if (!reviewByDocument.has(parsed.documentId)) {
          reviewByDocument.set(parsed.documentId, {
            status: parsed.status,
            reviewedAt: parsed.reviewedAt || "",
            reviewedBy: parsed.reviewedBy || null,
          });
        }
      } catch {
        continue;
      }
    }

    const generalDocumentUploads: FinanceGeneralDocumentUpload[] = [];
    for (const row of allGeneralDocumentLogs) {
      if (!row.details) continue;
      try {
        const parsed = JSON.parse(row.details) as {
          key?: string;
          documentId?: string;
          fileName?: string;
          fileUrl?: string;
          uploadedAt?: string;
          context?: {
            accountIndex?: number;
            sponsorType?: string;
            ownershipType?: string;
            customLabel?: string;
          } | null;
        };
        if (!parsed.documentId || !parsed.fileName || !parsed.fileUrl || !parsed.key) continue;
        const review = reviewByDocument.get(parsed.documentId);
        generalDocumentUploads.push({
          key: parsed.key,
          documentId: parsed.documentId,
          fileName: parsed.fileName,
          fileUrl: parsed.fileUrl,
          uploadedAt: parsed.uploadedAt || new Date().toISOString(),
          context: parsed.context || null,
          reviewStatus: review?.status || "PENDING",
          reviewedAt: review?.reviewedAt || null,
          reviewedBy: review?.reviewedBy || null,
        });
      } catch {
        continue;
      }
    }

    const financeRecord = await db.financeRecord.findUnique({
      where: { applicationId: params.id },
      include: {
        fundingSources: true,
        bankAccounts: true,
      },
    });

    const fundingFromModel = financeRecord
      ? {
          selectedSources: financeRecord.selectedSources,
          loan: (financeRecord.fundingSources.find((item) => item.sourceType === "EDUCATION_LOAN")?.detailsJson as {
            providerName: string;
            amountGbp: number;
            approvalDate: string;
            approvalLetterFileName: string;
            approvalLetterFileUrl: string;
          } | null) || null,
          personalFunds: {
            accounts: financeRecord.bankAccounts.map((account) => ({
              accountType: account.accountType,
              accountOwner: account.accountOwner,
              country: account.country,
              bankName: account.bankName,
              customBankName: account.customBankName || null,
              accountCurrency: account.accountCurrency,
              totalAmount: account.totalAmount,
              allocatedAmount: account.allocatedAmount,
              accessibleImmediately: account.accessibleImmediately,
            })),
            accountMeta: (financeRecord.fundingSources.find((item) => item.sourceType === "PERSONAL_FUNDS")?.detailsJson as {
              accountMeta?: Array<{
                accountHolderName?: string;
                ownershipType?: "MY_PARENTS" | "MY_SPONSOR" | "MY_LOAN_PROVIDER" | "OTHER_FAMILY_MEMBER" | "OTHER";
                ownershipOtherText?: string | null;
              }>;
            } | null)?.accountMeta || [],
          },
          sponsorship: (financeRecord.fundingSources.find((item) => item.sourceType === "SPONSORSHIP")?.detailsJson as {
            sponsorshipType?: "COMPANY" | "GOVERNMENT" | "UNIVERSITY" | "THIRD_PARTY_ORGANISATION" | null;
          } | null) || { sponsorshipType: null },
          otherExplanation: financeRecord.otherExplanation || null,
        }
      : null;

    const livingCostRows = await db.livingCostCountry.findMany({
      orderBy: { countryCode: "asc" },
      select: {
        countryCode: true,
        countryName: true,
        monthlyLivingCost: true,
        currency: true,
        defaultMonths: true,
        rulesJson: true,
      },
    });

    const overrides = new Map<string, FinancialRequirementRule>();
    for (const row of livingCostRows) {
      const key = normalizeCountryCode(row.countryCode);
      if (!key || overrides.has(key)) continue;
      const rules = Array.isArray(row.rulesJson)
        ? row.rulesJson.map((item) => String(item)).filter(Boolean)
        : [];
      overrides.set(key, {
        countryCode: key,
        countryName: String(row.countryName || key),
        monthlyLivingCost: Number(row.monthlyLivingCost || 0),
        currency: String(row.currency || "USD").toUpperCase(),
        defaultMonths: Number(row.defaultMonths || 12),
        rules,
      });
    }

    const defaultRule = resolveFinancialRequirement(application.university.country);
    const activeRule = overrides.get(countryCode) || defaultRule;

    const systemScholarship = application.scholarshipApps
      .filter((item) => item.status !== "REJECTED")
      .reduce((max, item) => {
        const value = item.awardedAmount ?? item.scholarship.amount ?? 0;
        return value > max ? value : max;
      }, 0);

    const courseFee = application.course.tuitionFee || 0;
    const offerCourseFee = offerUpload?.ocr?.courseFee ?? null;
    const offerScholarship = offerUpload?.ocr?.scholarship ?? null;
    const scholarshipFromSystem = systemScholarship;
    const scholarshipFinal = Math.max(scholarshipFromSystem, offerScholarship || 0);
    const depositPaid = approvedDeposits.reduce((sum, item) => sum + (item.amountPaid || 0), 0);

    const parsedMonths = parseDurationMonths(application.course.duration);
    const durationMonths = parsedMonths > 0 ? parsedMonths : activeRule.defaultMonths;
    const livingExpenses = activeRule.monthlyLivingCost * durationMonths;

    const remainingTuition = Math.max(courseFee - scholarshipFinal - depositPaid, 0);
    const totalToShowInBank = remainingTuition + livingExpenses;

    const latestCountryUpdate = await db.immigrationRuleChangelog.findFirst({
      where: {
        country: countryCode,
        alert: { status: "CONFIRMED_PUBLISHED" },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        summary: true,
        createdAt: true,
        oldMonthlyLivingCost: true,
        newMonthlyLivingCost: true,
        currency: true,
      },
    });

    return NextResponse.json({
      data: {
        studentId: application.student.id,
        studentFullName: `${application.student.firstName} ${application.student.lastName}`.trim(),
        hasOfferLetter: Boolean(offerUpload?.documentId),
        canApproveDeposit: canApproveDeposit(session.user.roleName),
        offerLetter: offerUpload,
        depositReceipt: {
          upload: depositUpload,
          approval: latestDepositApproval,
          approvals: approvedDeposits,
        },
        funding: fundingFromModel || fundingConfig,
        bankStatements,
        countrySpecificDocuments,
        generalDocuments: [
          {
            key: "SOURCE_OF_FUNDS",
            label: "Source of funds supporting documents",
            status: hasSourceOfFundsDocument ? "DONE" : "TODO",
            required: false,
            checklistItemId: null,
            uploadDocumentType: "FINANCIAL_PROOF",
          },
        ],
        generalDocumentUploads,
        permissions: {
          canReviewFinanceDocuments: canApproveDeposit(session.user.roleName),
        },
        summary: {
          courseFee,
          courseFeeCurrency: application.course.currency || "GBP",
          offerCourseFee,
          offerScholarship,
          scholarshipFromSystem,
          scholarshipFinal,
          depositPaid,
          livingExpenses,
          durationMonths,
          remainingTuition,
          totalToShowInBank,
          feeDiscrepancy: offerCourseFee !== null && Math.abs(offerCourseFee - courseFee) > 1,
          newScholarshipDetected: Boolean(offerScholarship && offerScholarship > scholarshipFromSystem),
        },
        rules: {
          active: activeRule,
          all: DEFAULT_FINANCIAL_REQUIREMENTS.map((row) => overrides.get(row.countryCode) || row),
        },
        immigrationUpdate: latestCountryUpdate
          ? {
              id: latestCountryUpdate.id,
              summary: latestCountryUpdate.summary,
              createdAt: latestCountryUpdate.createdAt.toISOString(),
              oldMonthlyLivingCost: latestCountryUpdate.oldMonthlyLivingCost,
              newMonthlyLivingCost: latestCountryUpdate.newMonthlyLivingCost,
              currency: latestCountryUpdate.currency,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/finance GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !canManageFunding(session.user.roleName)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const application = await db.application.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: {
            subAgent: { select: { userId: true } },
            user: { select: { id: true } },
          },
        },
        course: {
          select: {
            tuitionFee: true,
            duration: true,
          },
        },
        university: {
          select: {
            country: true,
          },
        },
        scholarshipApps: {
          where: {
            OR: [{ applicationId: params.id }, { applicationId: null }],
          },
          include: {
            scholarship: {
              select: {
                amount: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (
      session.user.roleName === "COUNSELLOR" &&
      application.student.assignedCounsellorId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      session.user.roleName === "SUB_AGENT" &&
      application.student.subAgent?.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.roleName === "STUDENT" && application.student.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = fundingPayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    const payload = parsed.data;
    if (payload.selectedSources.includes("EDUCATION_LOAN") && !payload.loan) {
      return NextResponse.json({ error: "Loan details are required when Education Loan is selected" }, { status: 400 });
    }

    if (
      payload.selectedSources.includes("PERSONAL_FUNDS") &&
      (!payload.personalFunds?.accounts || payload.personalFunds.accounts.length === 0)
    ) {
      return NextResponse.json({ error: "At least one personal bank account is required" }, { status: 400 });
    }

    if (payload.selectedSources.includes("OTHER") && !payload.otherExplanation?.trim()) {
      return NextResponse.json({ error: "Please provide an explanation for Other funding source" }, { status: 400 });
    }

    if (payload.personalFunds?.accounts?.some((item) => item.allocatedAmount > item.totalAmount)) {
      return NextResponse.json({ error: "Allocated amount cannot exceed total amount for any account" }, { status: 400 });
    }

    const systemScholarship = application.scholarshipApps
      .filter((item) => item.status !== "REJECTED")
      .reduce((max, item) => {
        const value = item.awardedAmount ?? item.scholarship.amount ?? 0;
        return value > max ? value : max;
      }, 0);

    const offerUpload = await readLatestAction<{
      ocr?: OfferLetterExtracted;
    }>(params.id, "offer_letter_uploaded");

    const depositApprovalLogs = await db.activityLog.findMany({
      where: {
        entityType: "application",
        entityId: params.id,
        action: "deposit_receipt_approved",
      },
      select: { details: true },
    });

    const depositPaid = depositApprovalLogs.reduce((sum, row) => {
      if (!row.details) return sum;
      try {
        const parsed = JSON.parse(row.details) as { amountPaid?: number | null };
        return sum + (parsed.amountPaid || 0);
      } catch {
        return sum;
      }
    }, 0);

    const countryCode = normalizeCountryCode(application.university.country);
    const livingCostCountry = await db.livingCostCountry.findUnique({
      where: { countryCode },
      select: {
        monthlyLivingCost: true,
        defaultMonths: true,
      },
    });

    const activeRule = resolveFinancialRequirement(application.university.country);
    const months = parseDurationMonths(application.course.duration) || activeRule.defaultMonths;
    const monthlyLivingCost = livingCostCountry?.monthlyLivingCost ?? activeRule.monthlyLivingCost;
    const livingExpenses = monthlyLivingCost * months;
    const scholarshipFinal = Math.max(systemScholarship, offerUpload?.ocr?.scholarship || 0);
    const remainingTuition = Math.max((application.course.tuitionFee || 0) - scholarshipFinal - depositPaid, 0);
    const totalRequired = remainingTuition + livingExpenses;

    const declaredFromLoan = payload.loan?.amountGbp || 0;
    const declaredFromPersonal = (payload.personalFunds?.accounts || []).reduce(
      (sum, account) => sum + Math.max(0, account.allocatedAmount || 0),
      0,
    );
    const declaredFromScholarship = payload.selectedSources.includes("UNIVERSITY_SCHOLARSHIP") ? scholarshipFinal : 0;
    const totalDeclared = declaredFromLoan + declaredFromPersonal + declaredFromScholarship;

    await db.$transaction(async (tx) => {
      const financeRecord = await tx.financeRecord.upsert({
        where: { applicationId: params.id },
        update: {
          selectedSources: payload.selectedSources,
          courseFee: application.course.tuitionFee || 0,
          courseFeeCurrency: "GBP",
          scholarshipFinal,
          depositPaid,
          remainingTuition,
          livingExpenses,
          durationMonths: months,
          totalToShowInBank: totalRequired,
          otherExplanation: payload.otherExplanation || null,
        },
        create: {
          applicationId: params.id,
          selectedSources: payload.selectedSources,
          courseFee: application.course.tuitionFee || 0,
          courseFeeCurrency: "GBP",
          scholarshipFinal,
          depositPaid,
          remainingTuition,
          livingExpenses,
          durationMonths: months,
          totalToShowInBank: totalRequired,
          otherExplanation: payload.otherExplanation || null,
        },
        select: { id: true },
      });

      await tx.fundingSource.deleteMany({ where: { financeRecordId: financeRecord.id } });
      await tx.bankAccount.deleteMany({ where: { financeRecordId: financeRecord.id } });

      if (payload.selectedSources.includes("UNIVERSITY_SCHOLARSHIP")) {
        await tx.fundingSource.create({
          data: {
            financeRecordId: financeRecord.id,
            sourceType: "UNIVERSITY_SCHOLARSHIP",
            declaredAmount: declaredFromScholarship,
            detailsJson: {
              scholarshipFinal,
            },
          },
        });
      }

      if (payload.selectedSources.includes("EDUCATION_LOAN") && payload.loan) {
        await tx.fundingSource.create({
          data: {
            financeRecordId: financeRecord.id,
            sourceType: "EDUCATION_LOAN",
            declaredAmount: payload.loan.amountGbp,
            detailsJson: payload.loan,
          },
        });
      }

      if (payload.selectedSources.includes("PERSONAL_FUNDS") && payload.personalFunds?.accounts?.length) {
        await tx.fundingSource.create({
          data: {
            financeRecordId: financeRecord.id,
            sourceType: "PERSONAL_FUNDS",
            declaredAmount: declaredFromPersonal,
            detailsJson: {
              totalAccounts: payload.personalFunds.accounts.length,
              accountMeta: payload.personalFunds.accountMeta || [],
            },
          },
        });

        await tx.bankAccount.createMany({
          data: payload.personalFunds.accounts.map((account) => ({
            financeRecordId: financeRecord.id,
            accountType: account.accountType,
            accountOwner: account.accountOwner,
            country: account.country,
            bankName: account.bankName,
            customBankName: account.customBankName || null,
            accountCurrency: account.accountCurrency,
            totalAmount: account.totalAmount,
            allocatedAmount: account.allocatedAmount,
            accessibleImmediately: account.accessibleImmediately,
          })),
        });
      }

      if (payload.selectedSources.includes("SPONSORSHIP")) {
        await tx.fundingSource.create({
          data: {
            financeRecordId: financeRecord.id,
            sourceType: "SPONSORSHIP",
            declaredAmount: 0,
            detailsJson: {
              sponsorshipType: payload.sponsorship?.sponsorshipType || null,
            },
          },
        });
      }

      if (payload.selectedSources.includes("OTHER")) {
        await tx.fundingSource.create({
          data: {
            financeRecordId: financeRecord.id,
            sourceType: "OTHER",
            declaredAmount: 0,
            detailsJson: {
              otherExplanation: payload.otherExplanation || null,
            },
          },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          entityType: "application",
          entityId: params.id,
          action: "funding_sources_updated",
          details: JSON.stringify({
            ...payload,
            updatedAt: new Date().toISOString(),
          }),
        },
      });
    });

    if (payload.selectedSources.length > 0) {
      await triggerFinanceInProgressFromFunding(params.id, session.user.id).catch(() => undefined);
    }

    if (totalDeclared >= totalRequired && totalRequired > 0) {
      await triggerFinanceComplete(params.id, session.user.id).catch(() => undefined);
    }

    return NextResponse.json({
      data: {
        ...payload,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/applications/[id]/finance PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
