"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, XCircle } from "lucide-react";
import { toast } from "sonner";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import ChecklistUploadZone from "@/components/ui/ChecklistUploadZone";
import { COUNTRIES } from "@/lib/countries";
import { toApiFilesDownloadPath, toApiFilesPath } from "@/lib/file-url";

type Props = {
  applicationId: string;
  userRole: string;
  studentNationality?: string | null;
  applicationStatus?: string | null;
  onSwitchTab?: (tab: string) => void;
};

type FinancePayload = {
  studentId?: string;
  studentFullName?: string;
  hasOfferLetter: boolean;
  offerLetterPrefillStatus?: "SUCCESS" | "FAILED" | null;
  offerLetterPrefillMessage?: string | null;
  canApproveDeposit: boolean;
  offerLetter: {
    documentId: string;
    fileName: string;
    fileUrl: string;
    ocr: {
      courseFee: number | null;
      scholarship: number | null;
      currency: string | null;
    };
  } | null;
  depositReceipt: {
    upload: {
      documentId: string;
      fileName: string;
      fileUrl: string;
      ocr: {
        amountPaid: number | null;
        paymentDate: string | null;
        paymentReference: string | null;
        currency: string | null;
      };
    } | null;
    approval: {
      approvedAt: string;
      amountPaid: number | null;
    } | null;
    approvals?: Array<{
      approvedAt: string;
      amountPaid: number | null;
      documentId: string;
    }>;
  };
  funding?: {
    selectedSources: Array<"SPONSORSHIP" | "UNIVERSITY_SCHOLARSHIP" | "EDUCATION_LOAN" | "PERSONAL_FUNDS" | "OTHER">;
    loan?: {
      providerName: string;
      amountGbp: number;
      approvalDate: string;
      approvalLetterFileName: string;
      approvalLetterFileUrl: string;
    } | null;
    personalFunds?: {
      accounts: Array<{
        accountType: "STANDARD" | "TERM_DEPOSIT" | "SAVINGS" | "INVESTMENT" | "PENSION" | "OTHER";
        accountOwner: "MY_OWN" | "SOMEONE_ELSE" | "JOINT";
        country: string;
        bankName: string;
        customBankName?: string | null;
        accountCurrency: string;
        totalAmount: number;
        allocatedAmount: number;
        accessibleImmediately: boolean;
      }>;
      accountMeta?: Array<{
        accountHolderName?: string;
        ownershipType?: "MY_PARENTS" | "MY_SPONSOR" | "MY_LOAN_PROVIDER" | "OTHER_FAMILY_MEMBER" | "OTHER";
        manualUk28DayStatus?: "YES" | "NO";
        ownershipOtherText?: string | null;
      }>;
    } | null;
    sponsorship?: {
      sponsorshipType?: "COMPANY" | "GOVERNMENT" | "UNIVERSITY" | "THIRD_PARTY_ORGANISATION" | null;
    } | null;
    otherExplanation?: string | null;
  };
  bankStatements?: Array<{
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
    outcome: "GREEN" | "AMBER" | "RED";
    message: string;
    approved: {
      approvedAt: string;
      approvedBy: string;
      documentId: string;
      checklistItemId: string;
      outcome: "GREEN" | "AMBER" | "RED" | null;
    } | null;
    extracted?: {
      accountHolderName?: string;
      bankName?: string;
      accountNumberMasked?: string;
      statementDate?: string | null;
      closingBalance?: number | null;
      openingBalance?: number | null;
      currency?: string | null;
      transactions?: Array<{
        date: string;
        description: string;
        amount: number;
      }>;
    };
    checks?: {
      nameMatch?: {
        passed: boolean;
        distance: number;
      };
      statementDateWindow?: {
        passed: boolean;
        details: string;
      };
      balanceSufficiency?: {
        passed: boolean;
        closingBalance: number | null;
        requiredAmount: number;
        shortfall: number;
      };
      uk28DayRule?: {
        status: "PASS" | "FAIL" | "CANNOT_CONFIRM" | "NOT_APPLICABLE";
        details: string;
        firstRequiredDate?: string | null;
        windowStart?: string | null;
        windowEnd?: string | null;
        currentDayCount?: number;
        remainingDays?: number;
        droppedBelowDate?: string | null;
        droppedBelowAmount?: number | null;
      };
    };
  }>;
  countrySpecificDocuments?: Array<{
    key: "PASSPORT" | "ACADEMIC" | "ENGLISH_TEST" | "TB_TEST" | "POST_STUDY_PLAN" | "BANK_STATEMENT";
    label: string;
    status: "DONE" | "TODO";
    required: boolean;
    checklistItemId: string | null;
    uploadDocumentType: string | null;
  }>;
  generalDocuments?: Array<{
    key: "SOURCE_OF_FUNDS";
    label: string;
    status: "DONE" | "TODO";
    required: boolean;
    checklistItemId: string | null;
    uploadDocumentType: string | null;
  }>;
  generalDocumentUploads?: Array<{
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
  }>;
  permissions?: {
    canReviewFinanceDocuments?: boolean;
  };
  summary: {
    courseFee: number;
    courseFeeCurrency: string;
    offerCourseFee: number | null;
    offerScholarship: number | null;
    scholarshipFromSystem: number;
    scholarshipFinal: number;
    depositPaid: number;
    livingExpenses: number;
    durationMonths: number;
    livingExpenseMonths?: number;
    livingExpenseRuleLabel?: string;
    remainingTuition: number;
    totalToShowInBank: number;
    feeDiscrepancy: boolean;
    newScholarshipDetected: boolean;
  };
  rules: {
    active: {
      countryName: string;
      rules: string[];
    };
    all?: Array<{
      countryCode: string;
      countryName: string;
      rules: string[];
    }>;
  };
  immigrationUpdate?: {
    id: string;
    summary: string;
    createdAt: string;
    oldMonthlyLivingCost: number | null;
    newMonthlyLivingCost: number | null;
    currency: string | null;
  } | null;
};

type FundingSource = "SPONSORSHIP" | "UNIVERSITY_SCHOLARSHIP" | "EDUCATION_LOAN" | "PERSONAL_FUNDS" | "OTHER";

type FundingAccount = {
  accountType: "STANDARD" | "TERM_DEPOSIT" | "SAVINGS" | "INVESTMENT" | "PENSION" | "OTHER";
  accountOwner: "MY_OWN" | "SOMEONE_ELSE" | "JOINT";
  country: string;
  bankName: string;
  customBankName: string;
  accountCurrency: string;
  totalAmount: number;
  allocatedAmount: number;
  accessibleImmediately: boolean;
};

type OwnershipType = "MY_PARENTS" | "MY_SPONSOR" | "MY_LOAN_PROVIDER" | "OTHER_FAMILY_MEMBER" | "OTHER";
type SponsorshipType = "COMPANY" | "GOVERNMENT" | "UNIVERSITY" | "THIRD_PARTY_ORGANISATION";

type AccountMeta = {
  accountHolderName: string;
  ownershipType?: OwnershipType;
  manualUk28DayStatus?: "YES" | "NO";
  ownershipOtherText: string;
};

const CANNOT_FIND_BANK = "I cannot find my bank";
const BANK_OPTIONS = [
  "HSBC",
  "Barclays",
  "Lloyds",
  "NatWest",
  "Santander",
  "Standard Chartered",
  "Citibank",
  "Bank of America",
  "RBC",
  "CIBC",
  "TD Bank",
  "Scotiabank",
  "ANZ",
  "Westpac",
  "Commonwealth Bank",
  CANNOT_FIND_BANK,
];

const DEFAULT_ACCOUNT: FundingAccount = {
  accountType: "STANDARD",
  accountOwner: "MY_OWN",
  country: "",
  bankName: "",
  customBankName: "",
  accountCurrency: "GBP",
  totalAmount: 0,
  allocatedAmount: 0,
  accessibleImmediately: true,
};

export default function ApplicationFinanceTab({ applicationId, userRole, studentNationality, applicationStatus, onSwitchTab }: Props) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [savingFunding, setSavingFunding] = useState(false);
  const [manualDepositAmount, setManualDepositAmount] = useState<string>("");
  const [uploadingBankIndex, setUploadingBankIndex] = useState<number | null>(null);
  const [uploadingGeneralDocKey, setUploadingGeneralDocKey] = useState<string | null>(null);
  const [activeGeneralDocKey, setActiveGeneralDocKey] = useState<string | null>(null);
  const [approvingBankDocumentId, setApprovingBankDocumentId] = useState<string | null>(null);
  const [reviewingFinanceDocId, setReviewingFinanceDocId] = useState<string | null>(null);
  const [deletingFinanceDocId, setDeletingFinanceDocId] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<FundingSource[]>([]);
  const [sponsorshipType, setSponsorshipType] = useState<SponsorshipType | "">("");
  const [accountMeta, setAccountMeta] = useState<AccountMeta[]>([]);
  const [loanLetterDateCheck, setLoanLetterDateCheck] = useState<{ issueDate: string | null; daysOld: number | null; isOlderThanSevenDays: boolean } | null>(null);
  const [loan, setLoan] = useState<{
    providerName: string;
    amountGbp: number;
    approvalDate: string;
    approvalLetterFileName: string;
    approvalLetterFileUrl: string;
  } | null>(null);
  const [otherExplanation, setOtherExplanation] = useState("");
  const [accounts, setAccounts] = useState<FundingAccount[]>([{ ...DEFAULT_ACCOUNT }]);
  const [data, setData] = useState<FinancePayload | null>(null);

  const canApproveByRole = userRole === "ADMIN" || userRole === "MANAGER" || userRole === "COUNSELLOR";
  const canViewBankDetails = canApproveByRole;

  function findStatementForAccountInList(
    account: FundingAccount,
    list: NonNullable<FinancePayload["bankStatements"]>,
  ) {
    const bankNameForMatch =
      account.bankName === CANNOT_FIND_BANK
        ? account.customBankName.trim() || account.bankName
        : account.bankName;

    return list.find((item) =>
      item.accountRef.accountOwner === account.accountOwner
      && item.accountRef.country.trim().toLowerCase() === account.country.trim().toLowerCase()
      && item.accountRef.accountCurrency.trim().toUpperCase() === account.accountCurrency.trim().toUpperCase()
      && item.accountRef.bankName.trim().toLowerCase() === bankNameForMatch.trim().toLowerCase(),
    );
  }

  function getLatestOwnershipDocument(
    key: string,
    accountIndex: number,
    ownershipType?: OwnershipType,
  ) {
    return (data?.generalDocumentUploads || []).find((doc) =>
      doc.key === key
      && doc.context?.accountIndex === accountIndex
      && (!ownershipType || doc.context?.ownershipType === ownershipType),
    );
  }

  function getLatestGeneralDocument(key: string) {
    return (data?.generalDocumentUploads || []).find((doc) => doc.key === key);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/applications/${applicationId}/finance`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load finance data");
      setData(json.data as FinancePayload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load finance data");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const effectiveCurrency = useMemo(
    () => data?.offerLetter?.ocr?.currency || data?.depositReceipt.upload?.ocr?.currency || data?.summary.courseFeeCurrency || "GBP",
    [data],
  );

  const selectedHasLoan = selectedSources.includes("EDUCATION_LOAN");
  const selectedHasPersonal = selectedSources.includes("PERSONAL_FUNDS");
  const selectedHasOther = selectedSources.includes("OTHER");

  const totalAllocated = useMemo(() => {
    const statements = data?.bankStatements || [];
    return accounts.reduce((sum, account, index) => {
      const statement = findStatementForAccountInList(account, statements);
      const manuallyRejected = accountMeta[index]?.manualUk28DayStatus === "NO";
      const ocrRejected = statement?.checks?.uk28DayRule?.status === "FAIL";
      if (manuallyRejected || ocrRejected) return sum;
      return sum + (Number(account.allocatedAmount) || 0);
    }, 0);
  }, [accounts, accountMeta, data?.bankStatements]);

  const livingExpenseMonths = data?.summary.livingExpenseMonths || data?.summary.durationMonths || 12;
  const livingExpenseRuleLabel = data?.summary.livingExpenseRuleLabel || `${livingExpenseMonths} months`;

  const displayDepositPaid = useMemo(() => {
    if (!data) return 0;
    const manual = Number(manualDepositAmount || 0);
    if (Number.isFinite(manual) && manual > 0) return Math.max(data.summary.depositPaid, manual);
    return data.summary.depositPaid;
  }, [data, manualDepositAmount]);

  const computedRemainingTuition = useMemo(() => {
    if (!data) return 0;
    return Math.max((data.summary.courseFee || 0) - (data.summary.scholarshipFinal || 0) - displayDepositPaid, 0);
  }, [data, displayDepositPaid]);

  const computedTotalRequiredInBank = useMemo(() => {
    if (!data) return 0;
    return computedRemainingTuition + (data.summary.livingExpenses || 0);
  }, [data, computedRemainingTuition]);

  const recommendedBuffer = computedTotalRequiredInBank * 1.25;

  const declaredContributions = useMemo(() => {
    const rows: Array<{ source: FundingSource; label: string; amount: number }> = [];

    if (selectedSources.includes("UNIVERSITY_SCHOLARSHIP")) {
      rows.push({
        source: "UNIVERSITY_SCHOLARSHIP",
        label: "University Scholarship",
        amount: Math.max(data?.summary.scholarshipFinal || 0, 0),
      });
    }

    if (selectedSources.includes("EDUCATION_LOAN")) {
      rows.push({
        source: "EDUCATION_LOAN",
        label: "Education Loan",
        amount: Math.max(loan?.amountGbp || 0, 0),
      });
    }

    if (selectedSources.includes("PERSONAL_FUNDS")) {
      rows.push({
        source: "PERSONAL_FUNDS",
        label: "Personal Funds",
        amount: Math.max(totalAllocated, 0),
      });
    }

    if (selectedSources.includes("SPONSORSHIP")) {
      rows.push({ source: "SPONSORSHIP", label: "Sponsorship", amount: 0 });
    }

    if (selectedSources.includes("OTHER")) {
      rows.push({ source: "OTHER", label: "Other", amount: 0 });
    }

    return rows;
  }, [selectedSources, loan?.amountGbp, totalAllocated, data?.summary.scholarshipFinal]);

  const fundAllocation = useMemo(() => {
    const remainingBySource = declaredContributions
      .filter((row) => row.amount > 0)
      .map((row) => ({
        label: row.label,
        remaining: row.amount,
      }));

    function allocateFromPool(target: number) {
      let remaining = target;
      const used: string[] = [];

      for (const row of remainingBySource) {
        if (remaining <= 0) break;
        const contribution = Math.min(row.remaining, remaining);
        if (contribution > 0) {
          used.push(row.label);
          row.remaining -= contribution;
          remaining -= contribution;
        }
      }

      return {
        sources: used.length ? used.join(" + ") : "No declared source",
        complete: remaining <= 0,
        shortfall: Math.max(remaining, 0),
      };
    }

    const course = allocateFromPool(computedRemainingTuition);
    const living = allocateFromPool(data?.summary.livingExpenses || 0);
    const totalRequired = computedTotalRequiredInBank;
    const totalDeclared = declaredContributions.reduce((sum, row) => sum + row.amount, 0);
    const totalGap = Math.max(totalRequired - totalDeclared, 0);

    return {
      course,
      living,
      totalRequired,
      totalDeclared,
      totalGap,
    };
  }, [computedRemainingTuition, computedTotalRequiredInBank, declaredContributions, data?.summary.livingExpenses]);

  useEffect(() => {
    if (!data?.funding) return;
    setSelectedSources(data.funding.selectedSources || []);
    setLoan(data.funding.loan || null);
    setOtherExplanation(data.funding.otherExplanation || "");
    setSponsorshipType((data.funding.sponsorship?.sponsorshipType as SponsorshipType) || "");
    setLoanLetterDateCheck(null);

    const mappedAccounts = (data.funding.personalFunds?.accounts || []).map((item) => ({
      accountType: item.accountType,
      accountOwner: item.accountOwner,
      country: item.country,
      bankName: item.bankName,
      customBankName: item.customBankName || "",
      accountCurrency: item.accountCurrency || "GBP",
      totalAmount: item.totalAmount,
      allocatedAmount: item.allocatedAmount,
      accessibleImmediately: item.accessibleImmediately,
    }));

    const nextAccounts = mappedAccounts.length ? mappedAccounts : [{ ...DEFAULT_ACCOUNT }];
    setAccounts(nextAccounts);

    const incomingMeta = data.funding.personalFunds?.accountMeta || [];
    setAccountMeta(nextAccounts.map((_, index) => ({
      accountHolderName: incomingMeta[index]?.accountHolderName || "",
      ownershipType: incomingMeta[index]?.ownershipType,
      manualUk28DayStatus: incomingMeta[index]?.manualUk28DayStatus,
      ownershipOtherText: incomingMeta[index]?.ownershipOtherText || "",
    })));
  }, [data]);

  function toggleSource(source: FundingSource) {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((item) => item !== source) : [...prev, source],
    );
  }

  async function uploadLoanApprovalLetter(file: File) {
    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "Upload failed");
      }
      const uploadedUrl = uploadJson.urls[0];

      setLoan((prev) => ({
        providerName: prev?.providerName || "",
        amountGbp: prev?.amountGbp || 0,
        approvalDate: prev?.approvalDate || "",
        approvalLetterFileName: file.name,
        approvalLetterFileUrl: uploadedUrl,
      }));

      const checkRes = await fetch(`/api/dashboard/applications/${applicationId}/finance/loan-letter/check-date`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: uploadedUrl }),
      });
      if (checkRes.ok) {
        const checkJson = await checkRes.json() as {
          data?: { issueDate: string | null; daysOld: number | null; isOlderThanSevenDays: boolean };
        };
        setLoanLetterDateCheck(checkJson.data || null);
      } else {
        setLoanLetterDateCheck(null);
      }

      toast.success(uploadJson.message ? `Loan approval letter uploaded. ${uploadJson.message}` : "Loan approval letter uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload loan letter");
    }
  }

  function findStatementForAccount(account: FundingAccount) {
    const list = data?.bankStatements || [];
    return findStatementForAccountInList(account, list);
  }

  async function uploadBankStatement(index: number, file: File) {
    const account = accounts[index];
    if (!account) return;

    const bankNameForPayload =
      account.bankName === CANNOT_FIND_BANK
        ? account.customBankName.trim() || account.bankName
        : account.bankName;

    if (!account.country.trim() || !bankNameForPayload.trim() || !account.accountCurrency.trim()) {
      toast.error("Please complete bank account details before uploading bank statement.");
      return;
    }

    setUploadingBankIndex(index);
    try {
      const formData = new FormData();
      formData.append("files", file);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      const verifyRes = await fetch(`/api/dashboard/applications/${applicationId}/finance/bank-statement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileUrl: uploadJson.urls[0],
          accountRef: {
            accountOwner: account.accountOwner,
            country: account.country,
            bankName: bankNameForPayload,
            accountCurrency: account.accountCurrency,
          },
        }),
      });

      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyJson.error || "Bank statement verification failed");
      }

      toast.success(uploadJson.message
        ? `Bank statement processed: ${verifyJson.data?.outcome || "completed"}. ${uploadJson.message}`
        : `Bank statement processed: ${verifyJson.data?.outcome || "completed"}.`);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to verify bank statement");
    } finally {
      setUploadingBankIndex(null);
    }
  }

  async function approveBankStatement(documentId: string) {
    if (!documentId) return;
    setApprovingBankDocumentId(documentId);

    try {
      const res = await fetch(`/api/dashboard/applications/${applicationId}/finance/bank-statement/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to approve bank statement");

      toast.success("Bank statement approved and checklist updated.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve bank statement");
    } finally {
      setApprovingBankDocumentId(null);
    }
  }

  async function uploadGeneralDocument(
    key: "SOURCE_OF_FUNDS",
    file: File,
  ) {
    await uploadFinanceDocument(key, file);
  }

  function updateAccount(index: number, next: Partial<FundingAccount>) {
    setAccounts((prev) =>
      prev.map((account, i) => {
        if (i !== index) return account;
        const merged = { ...account, ...next };
        if (merged.allocatedAmount > merged.totalAmount) {
          merged.allocatedAmount = merged.totalAmount;
        }
        return merged;
      }),
    );
  }

  function addAnotherAccount() {
    setAccounts((prev) => [...prev, { ...DEFAULT_ACCOUNT }]);
    setAccountMeta((prev) => [...prev, { accountHolderName: "", ownershipOtherText: "" }]);
  }

  function updateAccountMeta(index: number, next: Partial<AccountMeta>) {
    setAccountMeta((prev) => {
      const cloned = [...prev];
      while (cloned.length <= index) cloned.push({ accountHolderName: "", ownershipOtherText: "" });
      cloned[index] = { ...cloned[index], ...next };
      return cloned;
    });
  }

  function normalizeName(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
  }

  function isAccountNameMismatch(index: number) {
    const studentName = normalizeName(data?.studentFullName || "");
    const entered = normalizeName(accountMeta[index]?.accountHolderName || "");
    if (!studentName || !entered) return false;
    return studentName !== entered;
  }

  async function uploadFinanceDocument(
    key: string,
    file: File,
    context?: {
      accountIndex?: number;
      sponsorType?: SponsorshipType;
      ownershipType?: OwnershipType;
      customLabel?: string;
    },
  ) {
    setUploadingGeneralDocKey(key);
    try {
      const formData = new FormData();
      formData.append("files", file);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      const saveRes = await fetch(`/api/dashboard/applications/${applicationId}/finance/general-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          fileName: file.name,
          fileUrl: uploadJson.urls[0],
          context,
        }),
      });

      const saveJson = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveJson.error || "Failed to upload document");
      }

      toast.success(uploadJson.message ? `Document uploaded. ${uploadJson.message}` : "Document uploaded.");
      setActiveGeneralDocKey(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload document");
    } finally {
      setUploadingGeneralDocKey(null);
    }
  }

  async function reviewFinanceDocument(documentId: string, decision: "APPROVE" | "REJECT") {
    setReviewingFinanceDocId(documentId);
    try {
      const res = await fetch(`/api/dashboard/applications/${applicationId}/finance/general-documents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, decision }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to review document");
      toast.success(decision === "APPROVE" ? "Document approved." : "Document rejected.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to review document");
    } finally {
      setReviewingFinanceDocId(null);
    }
  }

  async function deleteFinanceDocument(documentId: string) {
    setDeletingFinanceDocId(documentId);
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete document");
      toast.success("Document deleted.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete document");
    } finally {
      setDeletingFinanceDocId(null);
    }
  }

  function renderOwnershipUploadStatus(
    key: string,
    accountIndex: number,
    ownershipType?: OwnershipType,
  ) {
    const uploaded = getLatestOwnershipDocument(key, accountIndex, ownershipType);
    if (!uploaded) return null;

    return (
      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-emerald-700">✓</span>
          <span className="text-emerald-900">{uploaded.fileName}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a
            href={toApiFilesPath(uploaded.fileUrl)}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            Preview
          </a>
          <button
            type="button"
            onClick={() => void deleteFinanceDocument(uploaded.documentId)}
            disabled={deletingFinanceDocId === uploaded.documentId}
            className="rounded border border-rose-300 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          >
            {deletingFinanceDocId === uploaded.documentId ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    );
  }

  function renderGeneralUploadStatus(key: string) {
    const uploaded = getLatestGeneralDocument(key);
    if (!uploaded) return null;

    return (
      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-emerald-700">✓</span>
          <span className="text-emerald-900">{uploaded.fileName}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a
            href={toApiFilesPath(uploaded.fileUrl)}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            Preview
          </a>
          <a
            href={toApiFilesDownloadPath(uploaded.fileUrl)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            Download
          </a>
          <button
            type="button"
            onClick={() => void deleteFinanceDocument(uploaded.documentId)}
            disabled={deletingFinanceDocId === uploaded.documentId}
            className="rounded border border-rose-300 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          >
            {deletingFinanceDocId === uploaded.documentId ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    );
  }

  async function saveFundingSources() {
    if (!selectedSources.length) {
      toast.error("Please select at least one funding source.");
      return;
    }

    if (selectedHasLoan && (!loan || !loan.providerName || !loan.amountGbp || !loan.approvalDate || !loan.approvalLetterFileUrl)) {
      toast.error("Please complete the loan section including approval letter upload.");
      return;
    }

    if (selectedHasPersonal && !accounts.length) {
      toast.error("Please add at least one bank account.");
      return;
    }

    if (selectedHasOther && !otherExplanation.trim()) {
      toast.error("Please explain the Other funding source.");
      return;
    }

    setSavingFunding(true);
    try {
      const res = await fetch(`/api/dashboard/applications/${applicationId}/finance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedSources,
          loan: selectedHasLoan ? loan : null,
          personalFunds: selectedHasPersonal
            ? {
                accounts: accounts.map((account) => ({
                  ...account,
                  bankName:
                    account.bankName === CANNOT_FIND_BANK
                      ? account.customBankName.trim() || account.bankName
                      : account.bankName,
                })),
                accountMeta: accounts.map((_, index) => ({
                  accountHolderName: accountMeta[index]?.accountHolderName || "",
                  ownershipType: accountMeta[index]?.ownershipType,
                  manualUk28DayStatus: accountMeta[index]?.manualUk28DayStatus,
                  ownershipOtherText: accountMeta[index]?.ownershipOtherText || null,
                })),
              }
            : null,
          sponsorship: selectedSources.includes("SPONSORSHIP")
            ? {
                sponsorshipType: sponsorshipType || null,
              }
            : null,
          otherExplanation: selectedHasOther ? otherExplanation : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save funding sources");
      toast.success("Funding sources saved.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save funding sources");
    } finally {
      setSavingFunding(false);
    }
  }

  async function uploadDepositReceipt(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadJson = (await uploadRes.json()) as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "Upload failed");
      }

      const res = await fetch(`/api/dashboard/applications/${applicationId}/finance/deposit-receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileUrl: uploadJson.urls[0],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to upload deposit receipt");

      const extractedAmount = json.data?.ocr?.amountPaid;
      const extractedCurrency = json.data?.ocr?.currency || "GBP";
      if (typeof extractedAmount === "number" && Number.isFinite(extractedAmount)) {
        const symbol = extractedCurrency === "GBP" ? "£" : `${extractedCurrency} `;
        toast.success(`Deposit receipt uploaded. Amount extracted: ${symbol}${extractedAmount.toLocaleString()}`);
      } else {
        toast.success("Deposit receipt uploaded successfully. Amount could not be extracted automatically — please enter it manually below.");
      }

      if (uploadJson.message) {
        toast.info(uploadJson.message);
      }
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload deposit receipt");
    } finally {
      setUploading(false);
    }
  }

  async function approveDeposit() {
    setApproving(true);
    try {
      const res = await fetch(`/api/dashboard/applications/${applicationId}/finance/deposit-receipt/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualAmount: manualDepositAmount ? Number(manualDepositAmount) : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to approve deposit");
      toast.success("Deposit approved successfully.");
      setManualDepositAmount("");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve deposit");
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading finance workflow...</div>;
  }

  if (!data) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">Unable to load finance details.</div>;
  }

  const isUnconditional = applicationStatus === "UNCONDITIONAL_OFFER"
    || applicationStatus === "FINANCE_IN_PROGRESS"
    || applicationStatus === "DEPOSIT_PAID"
    || applicationStatus === "FINANCE_COMPLETE"
    || applicationStatus === "CAS_ISSUED"
    || applicationStatus === "VISA_APPLIED"
    || applicationStatus === "ENROLLED";

  const pendingUpload = data.depositReceipt.upload;
  const pendingOcr = pendingUpload?.ocr;
  const hasPendingApproval = Boolean(pendingUpload && !data.depositReceipt.approval && canApproveByRole && data.canApproveDeposit);
  const approvedList = data.depositReceipt.approvals || [];

  function renderDepositSection(key: string) {
    return (
      <section
        key={key}
        className="rounded-lg p-6 space-y-5"
        style={
          isUnconditional
            ? { background: "linear-gradient(135deg, #1B2A4A 0%, #2f4f86 40%, #F5A623 100%)", border: "none" }
            : { border: "1px solid #e2e8f0", background: "#fff" }
        }
      >
        {isUnconditional && (
          <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white tracking-wide">
            🎉 Unconditional Offer — Deposit Receipt
          </span>
        )}
        <h3 className={`text-lg font-semibold ${isUnconditional ? "text-white" : "text-gray-900"}`}>
          Deposit Receipt Upload
        </h3>

        <div className={isUnconditional ? "rounded-xl bg-white/10 p-3" : ""}>
          <p className={`mb-2 text-xs font-medium ${isUnconditional ? "text-white/80" : "text-slate-600"}`}>
            Upload your deposit receipt — OCR will extract the amount automatically.
          </p>
          <ChecklistUploadZone
            onFileSelected={uploadDepositReceipt}
            uploading={uploading}
            studentId={data?.studentId}
            checklistItemName="Deposit Receipt"
            documentField={`finance:deposit-receipt:${applicationId}`}
            documentType="FINANCIAL_PROOF"
          />
        </div>

        {pendingUpload && (
          <div className={`rounded-lg p-4 text-sm ${isUnconditional ? "bg-white/15 text-white" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
            <p className={`font-semibold mb-2 ${isUnconditional ? "text-white" : "text-slate-900"}`}>
              OCR Extracted Details — Pending Approval
            </p>
            {pendingOcr ? (
              <div className="grid gap-1 sm:grid-cols-2">
                <p><span className="font-medium">Amount Paid:</span> {pendingOcr.amountPaid != null ? `${pendingOcr.amountPaid.toLocaleString()} ${pendingOcr.currency || ""}` : "—"}</p>
                <p><span className="font-medium">Payment Date:</span> {pendingOcr.paymentDate || "—"}</p>
                <p><span className="font-medium">Reference:</span> {pendingOcr.paymentReference || "—"}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">OCR results not yet available.</p>
            )}

            {(pendingOcr?.amountPaid == null || canApproveByRole) && (
              <div className="mt-3">
                <label className={`mb-1 block text-xs font-medium ${isUnconditional ? "text-white/80" : "text-slate-600"}`}>
                  {pendingOcr?.amountPaid != null
                    ? "Override extracted amount (staff only):"
                    : "OCR could not extract amount — enter manually:"}
                </label>
                <input
                  type="number"
                  min={0}
                  value={manualDepositAmount}
                  onChange={(e) => setManualDepositAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
            )}

            {hasPendingApproval && (
              <button
                type="button"
                onClick={() => void approveDeposit()}
                disabled={approving}
                className="mt-3 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {approving ? "Approving…" : "✓ Approve Deposit"}
              </button>
            )}
          </div>
        )}

        {approvedList.length > 0 && (
          <div className="space-y-2">
            <p className={`text-xs font-semibold uppercase tracking-wide ${isUnconditional ? "text-white/70" : "text-slate-500"}`}>
              Approved Deposits
            </p>
            {approvedList.map((item, idx) => (
              <div
                key={`${item.documentId}-${idx}`}
                className={`rounded-lg px-3 py-2 text-sm ${isUnconditional ? "bg-white/15 text-white" : "border border-slate-200 text-slate-700"}`}
              >
                <span className="font-medium">Deposit {idx + 1}: </span>
                {(item.amountPaid || 0).toLocaleString()} {effectiveCurrency}
                <span className={`ml-2 text-xs ${isUnconditional ? "text-white/60" : "text-slate-500"}`}>
                  {item.approvedAt ? new Date(item.approvedAt).toLocaleDateString("en-GB") : ""}
                </span>
              </div>
            ))}
            <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${isUnconditional ? "bg-white/20 text-white" : "border border-blue-200 bg-blue-50 text-blue-800"}`}>
              Total deducted from required funds: {(data?.summary.depositPaid ?? 0).toLocaleString()} {effectiveCurrency}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {data.offerLetterPrefillStatus === "SUCCESS" && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Offer letter scanned. Figures pre-filled. Please verify before proceeding.
        </section>
      )}

      {data.offerLetterPrefillStatus === "FAILED" && data.offerLetterPrefillMessage && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {data.offerLetterPrefillMessage}
        </section>
      )}

      {!data.hasOfferLetter && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          <p>Upload your offer letter to get started. Your financial summary will appear here.</p>
          {onSwitchTab && (
            <button
              type="button"
              onClick={() => onSwitchTab("documents")}
              className="mt-4 inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Upload Offer Letter
            </button>
          )}
        </section>
      )}

      {renderDepositSection("deposit-top")}

      <section id="funding-sources" className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Financial Summary</h3>

        {data.immigrationUpdate && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Financial requirements updated - re-review. {data.immigrationUpdate.summary}
          </div>
        )}

        {data.summary.feeDiscrepancy && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Offer letter fee differs from system record.
          </div>
        )}

        {data.summary.newScholarshipDetected && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mr-2 inline h-4 w-4" />
            New scholarship detected in offer letter.
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Course Fee</p><CurrencyDisplay amount={data.summary.courseFee} baseCurrency={data.summary.courseFeeCurrency} studentNationality={studentNationality || undefined} showYearSuffix={false} /></div>
          <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Scholarship</p><CurrencyDisplay amount={data.summary.scholarshipFinal} baseCurrency={effectiveCurrency} studentNationality={studentNationality || undefined} showYearSuffix={false} /></div>
          <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Deposit Paid</p><CurrencyDisplay amount={displayDepositPaid} baseCurrency={effectiveCurrency} studentNationality={studentNationality || undefined} showYearSuffix={false} /></div>
          <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">UKVI Living Cost ({livingExpenseMonths} months)</p><CurrencyDisplay amount={data.summary.livingExpenses} baseCurrency={effectiveCurrency} studentNationality={studentNationality || undefined} showYearSuffix={false} /></div>
          <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Remaining Tuition</p><CurrencyDisplay amount={computedRemainingTuition} baseCurrency={effectiveCurrency} studentNationality={studentNationality || undefined} showYearSuffix={false} /></div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-slate-500">Total Required Funds</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "#1B2A4A" }}>
              £{Math.round(computedTotalRequiredInBank).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <p className="font-semibold text-slate-900">Required Funds Breakdown</p>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between"><span>Tuition Fee</span><span>£{Math.round(data.summary.courseFee).toLocaleString()}</span></div>
            <div className="flex items-center justify-between"><span>- Deposit Paid</span><span>-£{Math.round(displayDepositPaid).toLocaleString()}</span></div>
            <div className="flex items-center justify-between"><span>- Scholarship</span><span>-£{Math.round(data.summary.scholarshipFinal).toLocaleString()}</span></div>
            <div className="border-t border-slate-300 pt-1 mt-1 flex items-center justify-between font-medium"><span>Remaining Tuition</span><span>£{Math.round(computedRemainingTuition).toLocaleString()}</span></div>
            <div className="flex items-center justify-between"><span>+ Living Expenses ({livingExpenseMonths}mo)</span><span>£{Math.round(data.summary.livingExpenses).toLocaleString()}</span></div>
            <div className="border-t border-slate-300 pt-2 mt-2 flex items-center justify-between text-2xl font-bold" style={{ color: "#1B2A4A" }}><span>Total Required Funds</span><span>£{Math.round(computedTotalRequiredInBank).toLocaleString()}</span></div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">How will you fund your studies? (select all that apply)</h3>

        <div className="mt-4 space-y-3 text-sm text-slate-700">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={selectedSources.includes("SPONSORSHIP")}
              onChange={() => toggleSource("SPONSORSHIP")}
              className="mt-1"
            />
            <div>
              <p className="font-medium text-slate-900">Company or Government Sponsorship</p>
              {selectedSources.includes("SPONSORSHIP") && (
                <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-700">Select sponsorship type</p>
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    {[
                      { value: "COMPANY", label: "Company Sponsorship" },
                      { value: "GOVERNMENT", label: "Government Sponsorship" },
                      { value: "UNIVERSITY", label: "University Sponsorship" },
                      { value: "THIRD_PARTY_ORGANISATION", label: "Third Party Organisation" },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`sponsorship-type-${applicationId}`}
                          checked={sponsorshipType === option.value}
                          onChange={() => setSponsorshipType(option.value as SponsorshipType)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>

                  <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">Required: Official Confirmation Letter</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      <li>Must be on official letterhead.</li>
                      <li>Must be signed by authorised person.</li>
                      <li>Must state the sponsored amount.</li>
                    </ul>
                  </div>

                  <ChecklistUploadZone
                    onFileSelected={(file) => uploadFinanceDocument("SPONSORSHIP_CONFIRMATION_LETTER", file, {
                      sponsorType: sponsorshipType || undefined,
                      customLabel: sponsorshipType ? `${sponsorshipType} sponsorship confirmation` : undefined,
                    })}
                    uploading={uploadingGeneralDocKey === "SPONSORSHIP_CONFIRMATION_LETTER"}
                    compact
                    studentId={data.studentId}
                    checklistItemName="Official Sponsorship Confirmation Letter"
                    documentField={`finance:sponsorship-confirmation:${applicationId}:${sponsorshipType || "default"}`}
                    documentType="FINANCIAL_PROOF"
                  />
                </div>
              )}
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={selectedSources.includes("UNIVERSITY_SCHOLARSHIP")}
              onChange={() => toggleSource("UNIVERSITY_SCHOLARSHIP")}
              className="mt-1"
            />
            <div className="w-full">
              <p className="font-medium text-slate-900">University Scholarship</p>
              <p className="text-xs text-slate-500">Auto-populated from scholarship record</p>
              <div className="mt-2 max-w-sm">
                <CurrencyDisplay
                  amount={data.summary.scholarshipFinal}
                  baseCurrency={effectiveCurrency}
                  studentNationality={studentNationality || undefined}
                />
              </div>

              {selectedSources.includes("UNIVERSITY_SCHOLARSHIP") && (
                <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <p className="font-semibold text-slate-900">Upload Scholarship Confirmation Letter</p>
                    <p className="mt-1 text-xs text-slate-600">Official letter from the university confirming your scholarship award</p>
                    <p className="mt-2 whitespace-pre-line text-xs text-slate-500">{"Drag & drop your file here\nPDF, JPG, JPEG, PNG, WEBP, HEIC supported.\nImages are auto-converted to PDF.\nFiles over 5MB are auto-compressed."}</p>
                  </div>

                  <ChecklistUploadZone
                    onFileSelected={(file) => uploadFinanceDocument("SCHOLARSHIP_LETTER", file, {
                      customLabel: "Scholarship Confirmation Letter",
                    })}
                    uploading={uploadingGeneralDocKey === "SCHOLARSHIP_LETTER"}
                    compact
                    studentId={data.studentId}
                    checklistItemName="Scholarship Confirmation Letter"
                    documentField={`finance:scholarship-letter:${applicationId}`}
                    documentType="FINANCIAL_PROOF"
                  />

                  {renderGeneralUploadStatus("SCHOLARSHIP_LETTER")}
                </div>
              )}
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={selectedSources.includes("EDUCATION_LOAN")}
              onChange={() => {
                toggleSource("EDUCATION_LOAN");
                setLoan((prev) =>
                  prev || {
                    providerName: "",
                    amountGbp: 0,
                    approvalDate: "",
                    approvalLetterFileName: "",
                    approvalLetterFileUrl: "",
                  },
                );
              }}
              className="mt-1"
            />
            <div className="w-full">
              <p className="font-medium text-slate-900">Education Loan</p>

              {selectedHasLoan && (
                <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Loan Provider name</label>
                      <input
                        value={loan?.providerName || ""}
                        onChange={(e) =>
                          setLoan((prev) => ({
                            providerName: e.target.value,
                            amountGbp: prev?.amountGbp || 0,
                            approvalDate: prev?.approvalDate || "",
                            approvalLetterFileName: prev?.approvalLetterFileName || "",
                            approvalLetterFileUrl: prev?.approvalLetterFileUrl || "",
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Loan amount (GBP equivalent)</label>
                      <input
                        type="number"
                        min={0}
                        value={loan?.amountGbp || 0}
                        onChange={(e) =>
                          setLoan((prev) => ({
                            providerName: prev?.providerName || "",
                            amountGbp: Number(e.target.value || 0),
                            approvalDate: prev?.approvalDate || "",
                            approvalLetterFileName: prev?.approvalLetterFileName || "",
                            approvalLetterFileUrl: prev?.approvalLetterFileUrl || "",
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Loan approval date</label>
                      <input
                        type="date"
                        value={loan?.approvalDate || ""}
                        onChange={(e) =>
                          setLoan((prev) => ({
                            providerName: prev?.providerName || "",
                            amountGbp: prev?.amountGbp || 0,
                            approvalDate: e.target.value,
                            approvalLetterFileName: prev?.approvalLetterFileName || "",
                            approvalLetterFileUrl: prev?.approvalLetterFileUrl || "",
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-600">Upload loan approval letter</p>
                    <ChecklistUploadZone onFileSelected={uploadLoanApprovalLetter} uploading={false} compact />
                    {loan?.approvalLetterFileName && (
                      <p className="mt-2 text-xs text-emerald-700">Uploaded: {loan.approvalLetterFileName}</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">Required loan letter rules</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      <li>Must be from a registered bank only.</li>
                      <li>Must be hand signed by a bank officer.</li>
                      <li>Must have official bank stamp.</li>
                      <li>Must be dated within 7 days of submission.</li>
                      <li>Must state exact approved amount.</li>
                      <li>Must confirm no conditions other than visa approval.</li>
                    </ul>
                    {loanLetterDateCheck?.isOlderThanSevenDays && (
                      <p className="mt-2 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-amber-900">
                        This letter may be too old. Loan letters must be dated within 7 days of submission.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={selectedSources.includes("PERSONAL_FUNDS")}
              onChange={() => toggleSource("PERSONAL_FUNDS")}
              className="mt-1"
            />
            <div className="w-full">
              <p className="font-medium text-slate-900">Myself or My Family (Personal Funds)</p>

              {selectedHasPersonal && (
                <div className="mt-3 space-y-4">
                  {accounts.map((account, index) => {
                    const remaining = Math.max((account.totalAmount || 0) - (account.allocatedAmount || 0), 0);
                    const statement = findStatementForAccount(account);
                    const manual28DayStatus = accountMeta[index]?.manualUk28DayStatus;
                    const ocr28DayFailed = statement?.checks?.uk28DayRule?.status === "FAIL";
                    const isCancelledForFunding = manual28DayStatus === "NO" || ocr28DayFailed;
                    const effectiveAllocatedAmount = isCancelledForFunding ? 0 : (account.allocatedAmount || 0);
                    const coversCourse = effectiveAllocatedAmount >= computedRemainingTuition;
                    const coversLiving = effectiveAllocatedAmount >= data.summary.livingExpenses;
                    const outcomeClasses =
                      statement?.outcome === "GREEN"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : statement?.outcome === "AMBER"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-red-200 bg-red-50 text-red-800";

                    return (
                      <div key={`fund-account-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Account Type</label>
                            <select
                              value={account.accountType}
                              onChange={(e) => updateAccount(index, { accountType: e.target.value as FundingAccount["accountType"] })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2"
                            >
                              <option value="STANDARD">Standard</option>
                              <option value="TERM_DEPOSIT">Term Deposit</option>
                              <option value="SAVINGS">Savings</option>
                              <option value="INVESTMENT">Investment</option>
                              <option value="PENSION">Pension</option>
                              <option value="OTHER">Other</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Account Owner</label>
                            <select
                              value={account.accountOwner}
                              onChange={(e) => updateAccount(index, { accountOwner: e.target.value as FundingAccount["accountOwner"] })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2"
                            >
                              <option value="MY_OWN">My own</option>
                              <option value="SOMEONE_ELSE">Someone else’s</option>
                              <option value="JOINT">Joint account</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Country</label>
                            <input
                              list={`country-list-${applicationId}`}
                              value={account.country}
                              onChange={(e) => updateAccount(index, { country: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2"
                              placeholder="Search country"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Bank Name</label>
                            <input
                              list={`bank-list-${applicationId}`}
                              value={account.bankName}
                              onChange={(e) => updateAccount(index, { bankName: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2"
                              placeholder="Search bank"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Account holder full name</label>
                            <input
                              value={accountMeta[index]?.accountHolderName || ""}
                              onChange={(e) => updateAccountMeta(index, { accountHolderName: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2"
                              placeholder="As shown on bank account"
                            />
                          </div>

                          {account.bankName === CANNOT_FIND_BANK && (
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-600">Enter bank name</label>
                              <input
                                value={account.customBankName}
                                onChange={(e) => updateAccount(index, { customBankName: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                              />
                            </div>
                          )}

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Account currency</label>
                            <input
                              value={account.accountCurrency}
                              onChange={(e) => updateAccount(index, { accountCurrency: e.target.value.toUpperCase().slice(0, 3) })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2"
                              maxLength={3}
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Total amount in this account</label>
                            <input
                              type="number"
                              min={0}
                              value={account.totalAmount}
                              onChange={(e) => updateAccount(index, { totalAmount: Number(e.target.value || 0) })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Amount allocated to study</label>
                            <input
                              type="number"
                              min={0}
                              max={account.totalAmount}
                              value={account.allocatedAmount}
                              onChange={(e) => updateAccount(index, { allocatedAmount: Number(e.target.value || 0) })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Remaining amount after allocation</label>
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                              {remaining.toLocaleString()} {account.accountCurrency || ""}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="mb-2 text-xs font-medium text-slate-600">Can funds be accessed immediately?</p>
                          <div className="flex items-center gap-4 text-sm">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="radio"
                                checked={account.accessibleImmediately}
                                onChange={() => updateAccount(index, { accessibleImmediately: true })}
                              />
                              Yes
                            </label>
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="radio"
                                checked={!account.accessibleImmediately}
                                onChange={() => updateAccount(index, { accessibleImmediately: false })}
                              />
                              No
                            </label>
                          </div>
                        </div>

                        {isAccountNameMismatch(index) && (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-sm font-semibold text-amber-900">Who does this bank account belong to?</p>
                            <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                              {[
                                { value: "MY_PARENTS", label: "My Parents" },
                                { value: "MY_SPONSOR", label: "My Sponsor" },
                                { value: "MY_LOAN_PROVIDER", label: "My Loan Provider" },
                                { value: "OTHER_FAMILY_MEMBER", label: "Other Family Member" },
                                { value: "OTHER", label: "Other" },
                              ].map((option) => (
                                <label key={option.value} className="inline-flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`ownership-${applicationId}-${index}`}
                                    checked={accountMeta[index]?.ownershipType === option.value}
                                    onChange={() => updateAccountMeta(index, { ownershipType: option.value as OwnershipType })}
                                  />
                                  {option.label}
                                </label>
                              ))}
                            </div>

                            {accountMeta[index]?.ownershipType === "OTHER" && (
                              <input
                                value={accountMeta[index]?.ownershipOtherText || ""}
                                onChange={(e) => updateAccountMeta(index, { ownershipOtherText: e.target.value })}
                                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Please specify"
                              />
                            )}

                            {(accountMeta[index]?.ownershipType === "MY_PARENTS" || accountMeta[index]?.ownershipType === "OTHER_FAMILY_MEMBER") && (
                              <div className="mt-3 space-y-3">
                                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                                  <p className="font-semibold text-slate-900">
                                    {accountMeta[index]?.ownershipType === "OTHER_FAMILY_MEMBER" ? "Upload Family Member ID Document" : "Upload Parent ID Document"}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {accountMeta[index]?.ownershipType === "OTHER_FAMILY_MEMBER"
                                      ? "Passport or National ID of your family member"
                                      : "Passport or National ID of your parent"}
                                  </p>
                                  <p className="mt-2 whitespace-pre-line text-xs text-slate-500">{"Drag & drop your file here\nPDF, JPG, JPEG, PNG, WEBP, HEIC supported.\nImages are auto-converted to PDF.\nFiles over 5MB are auto-compressed."}</p>
                                </div>
                                <ChecklistUploadZone
                                  onFileSelected={(file) => uploadFinanceDocument("PARENT_ID_DOCUMENT", file, {
                                    accountIndex: index,
                                    ownershipType: accountMeta[index]?.ownershipType,
                                  })}
                                  uploading={uploadingGeneralDocKey === "PARENT_ID_DOCUMENT"}
                                  compact
                                  studentId={data.studentId}
                                  checklistItemName="Parent ID Document"
                                  documentField={`finance:parent-id:${applicationId}:${index}`}
                                  documentType="FINANCIAL_PROOF"
                                />
                                {renderOwnershipUploadStatus("PARENT_ID_DOCUMENT", index, accountMeta[index]?.ownershipType)}

                                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                                  <p className="font-semibold text-slate-900">Upload Birth Certificate</p>
                                  <p className="mt-1 text-xs text-slate-600">To prove your relationship with the account holder</p>
                                  <p className="mt-2 whitespace-pre-line text-xs text-slate-500">{"Drag & drop your file here\nPDF, JPG, JPEG, PNG, WEBP, HEIC supported.\nImages are auto-converted to PDF.\nFiles over 5MB are auto-compressed."}</p>
                                </div>
                                <ChecklistUploadZone
                                  onFileSelected={(file) => uploadFinanceDocument("BIRTH_CERTIFICATE", file, {
                                    accountIndex: index,
                                    ownershipType: accountMeta[index]?.ownershipType,
                                  })}
                                  uploading={uploadingGeneralDocKey === "BIRTH_CERTIFICATE"}
                                  compact
                                  studentId={data.studentId}
                                  checklistItemName="Birth Certificate"
                                  documentField={`finance:birth-cert:${applicationId}:${index}`}
                                  documentType="FINANCIAL_PROOF"
                                />
                                {renderOwnershipUploadStatus("BIRTH_CERTIFICATE", index, accountMeta[index]?.ownershipType)}

                                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                                  <p className="font-semibold text-slate-900">
                                    {accountMeta[index]?.ownershipType === "OTHER_FAMILY_MEMBER" ? "Upload Family Member Declaration Letter" : "Upload Declaration Letter"}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {accountMeta[index]?.ownershipType === "OTHER_FAMILY_MEMBER"
                                      ? "Signed letter from your family member confirming permission to use these funds for your studies"
                                      : "Signed letter from your parent confirming permission to use these funds for your studies"}
                                  </p>
                                  <p className="mt-2 whitespace-pre-line text-xs text-slate-500">{"Drag & drop your file here\nPDF, JPG, JPEG, PNG, WEBP, HEIC supported.\nImages are auto-converted to PDF.\nFiles over 5MB are auto-compressed."}</p>
                                </div>
                                <ChecklistUploadZone
                                  onFileSelected={(file) => uploadFinanceDocument("DECLARATION_LETTER", file, {
                                    accountIndex: index,
                                    ownershipType: accountMeta[index]?.ownershipType,
                                  })}
                                  uploading={uploadingGeneralDocKey === "DECLARATION_LETTER"}
                                  compact
                                  studentId={data.studentId}
                                  checklistItemName="Declaration Letter"
                                  documentField={`finance:declaration-letter:${applicationId}:${index}`}
                                  documentType="FINANCIAL_PROOF"
                                />
                                {renderOwnershipUploadStatus("DECLARATION_LETTER", index, accountMeta[index]?.ownershipType)}
                              </div>
                            )}

                            {accountMeta[index]?.ownershipType === "MY_SPONSOR" && (
                              <div className="mt-3 space-y-3">
                                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                                  <p className="font-semibold text-slate-900">Upload Sponsor ID Document</p>
                                  <p className="mt-1 text-xs text-slate-600">Passport or official ID of your sponsor</p>
                                  <p className="mt-2 whitespace-pre-line text-xs text-slate-500">{"Drag & drop your file here\nPDF, JPG, JPEG, PNG, WEBP, HEIC supported.\nImages are auto-converted to PDF.\nFiles over 5MB are auto-compressed."}</p>
                                </div>
                                <ChecklistUploadZone
                                  onFileSelected={(file) => uploadFinanceDocument("SPONSOR_ID_DOCUMENT", file, {
                                    accountIndex: index,
                                    ownershipType: accountMeta[index]?.ownershipType,
                                  })}
                                  uploading={uploadingGeneralDocKey === "SPONSOR_ID_DOCUMENT"}
                                  compact
                                  studentId={data.studentId}
                                  checklistItemName="Sponsor ID Document"
                                  documentField={`finance:sponsor-id:${applicationId}:${index}`}
                                  documentType="FINANCIAL_PROOF"
                                />
                                {renderOwnershipUploadStatus("SPONSOR_ID_DOCUMENT", index, accountMeta[index]?.ownershipType)}

                                <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                                  <p className="font-semibold text-slate-900">Upload Sponsorship Declaration Letter</p>
                                  <p className="mt-1 text-xs text-slate-600">Official letter confirming sponsorship of your studies</p>
                                  <p className="mt-2 whitespace-pre-line text-xs text-slate-500">{"Drag & drop your file here\nPDF, JPG, JPEG, PNG, WEBP, HEIC supported.\nImages are auto-converted to PDF.\nFiles over 5MB are auto-compressed."}</p>
                                </div>
                                <ChecklistUploadZone
                                  onFileSelected={(file) => uploadFinanceDocument("SPONSORSHIP_DECLARATION_LETTER", file, {
                                    accountIndex: index,
                                    ownershipType: accountMeta[index]?.ownershipType,
                                  })}
                                  uploading={uploadingGeneralDocKey === "SPONSORSHIP_DECLARATION_LETTER"}
                                  compact
                                  studentId={data.studentId}
                                  checklistItemName="Sponsorship Declaration Letter"
                                  documentField={`finance:sponsor-declaration:${applicationId}:${index}`}
                                  documentType="FINANCIAL_PROOF"
                                />
                                {renderOwnershipUploadStatus("SPONSORSHIP_DECLARATION_LETTER", index, accountMeta[index]?.ownershipType)}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-semibold text-slate-900">Bank Statement Upload</p>
                          <p className="mt-1 text-xs text-slate-500">Upload latest statement for OCR verification.</p>

                          <div className="mt-3">
                            <ChecklistUploadZone
                              onFileSelected={(file) => uploadBankStatement(index, file)}
                              uploading={uploadingBankIndex === index}
                              compact
                              studentId={data.studentId}
                              checklistItemName="Bank Statement"
                              documentField={`finance:bank-statement:${applicationId}:${index}`}
                              documentType="FINANCIAL_PROOF"
                            />
                          </div>

                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-sm font-semibold text-slate-900">
                              Did the required amount of £{Math.round(computedTotalRequiredInBank).toLocaleString()} remain in your account for 28 consecutive days without dropping below this amount?
                            </p>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => updateAccountMeta(index, { manualUk28DayStatus: "YES" })}
                                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${manual28DayStatus === "YES" ? "border-emerald-400 bg-emerald-100 text-emerald-900" : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"}`}
                              >
                                ✅ YES - The amount stayed above £{Math.round(computedTotalRequiredInBank).toLocaleString()} for at least 28 consecutive days
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAccountMeta(index, { manualUk28DayStatus: "NO" })}
                                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${manual28DayStatus === "NO" ? "border-rose-400 bg-rose-100 text-rose-900" : "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"}`}
                              >
                                ❌ NO - The amount dropped below £{Math.round(computedTotalRequiredInBank).toLocaleString()} at some point
                              </button>
                            </div>
                          </div>

                          {manual28DayStatus === "NO" && (
                            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                              <p className="font-semibold">Statement Cancelled - 28-day rule failed</p>
                              <p className="mt-1">
                                Your bank statement does not meet the UK 28-day rule. The required amount must remain in your account for 28 consecutive days without going below £{Math.round(computedTotalRequiredInBank).toLocaleString()}. Please provide an updated bank statement once the 28 days have been completed.
                              </p>
                              <p className="mt-2 font-medium">
                                This bank account has been removed from your funding calculation. Please add a new bank account.
                              </p>
                            </div>
                          )}

                          {isCancelledForFunding && manual28DayStatus !== "NO" && (
                            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                              <p className="font-semibold">Statement Cancelled - 28-day rule failed</p>
                              <p className="mt-1">This bank account has been removed from your funding calculation. Please add a new bank account.</p>
                            </div>
                          )}

                          {statement && (
                            <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${outcomeClasses}`}>
                              <p className="font-semibold">{statement.outcome} outcome</p>
                              <p className="mt-1 whitespace-pre-line">{statement.message}</p>

                              <div className="mt-2 grid gap-2 text-xs text-slate-700 md:grid-cols-2">
                                <p><span className="font-semibold">Bank:</span> {statement.extracted?.bankName || "-"}</p>
                                <p><span className="font-semibold">Account:</span> {statement.extracted?.accountNumberMasked || "****"}</p>
                                <p><span className="font-semibold">Statement Date:</span> {statement.extracted?.statementDate || "-"}</p>
                                <p><span className="font-semibold">Closing Balance:</span> {statement.extracted?.closingBalance != null ? `${statement.extracted.closingBalance.toLocaleString()} ${statement.extracted?.currency || ""}` : "-"}</p>
                              </div>

                              {canViewBankDetails && statement.checks && (
                                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
                                  <p className="font-semibold text-slate-900">OCR Report (Internal)</p>
                                  <ul className="mt-1 list-disc space-y-1 pl-5">
                                    <li>Name match: {statement.checks.nameMatch?.passed ? "Pass" : "Fail"} (distance: {statement.checks.nameMatch?.distance ?? "-"})</li>
                                    <li>Date window: {statement.checks.statementDateWindow?.passed ? "Pass" : "Fail"} ({statement.checks.statementDateWindow?.details || "-"})</li>
                                    <li>Balance check: {statement.checks.balanceSufficiency?.passed ? "Pass" : "Fail"}</li>
                                    <li>28-day rule: {statement.checks.uk28DayRule?.status || "-"} ({statement.checks.uk28DayRule?.details || "-"})</li>
                                  </ul>

                                  {statement.checks.uk28DayRule && statement.checks.uk28DayRule.status !== "NOT_APPLICABLE" && (
                                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                      <p>Date required amount first appeared: {statement.checks.uk28DayRule.firstRequiredDate || "-"}</p>
                                      <p>28-day period: {(statement.checks.uk28DayRule.windowStart || "-")} to {(statement.checks.uk28DayRule.windowEnd || "-")}</p>
                                      <p>Current day count: {statement.checks.uk28DayRule.currentDayCount ?? 0} of 28 days</p>
                                      <p>
                                        Status: {statement.checks.uk28DayRule.status === "PASS"
                                          ? "Confirmed"
                                          : statement.checks.uk28DayRule.status === "FAIL"
                                            ? "Failed"
                                            : "In Progress"}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {canApproveByRole && !statement.approved && (
                                <button
                                  type="button"
                                  onClick={() => void approveBankStatement(statement.documentId)}
                                  disabled={approvingBankDocumentId === statement.documentId}
                                  className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  {approvingBankDocumentId === statement.documentId ? "Approving..." : "Approve Bank Statement"}
                                </button>
                              )}

                              {statement.approved && (
                                <p className="mt-2 text-xs font-semibold text-emerald-700">Approved on {new Date(statement.approved.approvedAt).toLocaleDateString("en-GB")}</p>
                              )}
                            </div>
                          )}
                        </div>

                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Money must be held in account for 28 consecutive days (UK rule).
                        </p>

                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                            <p className="text-xs text-slate-500">Covers Course Fee</p>
                            <p className={`mt-1 inline-flex items-center gap-1 font-semibold ${coversCourse ? "text-emerald-700" : "text-red-700"}`}>
                              {coversCourse ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                              {coversCourse ? "Complete" : "Shortfall"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                            <p className="text-xs text-slate-500">Covers Living Cost</p>
                            <p className={`mt-1 inline-flex items-center gap-1 font-semibold ${coversLiving ? "text-emerald-700" : "text-red-700"}`}>
                              {coversLiving ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                              {coversLiving ? "Complete" : "Shortfall"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <datalist id={`country-list-${applicationId}`}>
                    {COUNTRIES.map((country) => (
                      <option key={country} value={country} />
                    ))}
                  </datalist>

                  <datalist id={`bank-list-${applicationId}`}>
                    {BANK_OPTIONS.map((bank) => (
                      <option key={bank} value={bank} />
                    ))}
                  </datalist>

                  {totalAllocated < recommendedBuffer && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <p className="font-semibold">Your declared funds are below the recommended buffer.</p>
                      <p className="mt-1">UK visa officers often expect funds to exceed the minimum requirement.</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={addAnotherAccount}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    + Add Another Account
                  </button>

                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">Please upload evidence of source of funds</p>
                    <p className="mt-1 text-xs text-slate-500">e.g. salary slips, business income, property sale, inheritance documents</p>
                    <div className="mt-3">
                      <ChecklistUploadZone
                        onFileSelected={(file) => uploadFinanceDocument("SOURCE_OF_FUNDS_EVIDENCE", file)}
                        uploading={uploadingGeneralDocKey === "SOURCE_OF_FUNDS_EVIDENCE"}
                        compact
                        studentId={data.studentId}
                        checklistItemName="Source of Funds Evidence"
                        documentField={`finance:source-of-funds-evidence:${applicationId}`}
                        documentType="FINANCIAL_PROOF"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={selectedSources.includes("OTHER")}
              onChange={() => toggleSource("OTHER")}
              className="mt-1"
            />
            <div className="w-full">
              <p className="font-medium text-slate-900">Other</p>
              {selectedHasOther && (
                <textarea
                  rows={3}
                  value={otherExplanation}
                  onChange={(e) => setOtherExplanation(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Explain other funding source"
                />
              )}
            </div>
          </label>
        </div>

        <button
          type="button"
          onClick={() => void saveFundingSources()}
          disabled={savingFunding}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {savingFunding ? "Saving..." : "Save Funding Sources"}
        </button>
      </section>


      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Fund Allocation Summary</h3>

        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Remaining Tuition Fee</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="font-medium text-slate-900">£{Math.round(computedRemainingTuition).toLocaleString()}</p>
              <p className={`inline-flex items-center gap-1 font-semibold ${fundAllocation.course.complete ? "text-emerald-700" : "text-red-700"}`}>
                {fundAllocation.course.complete ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {fundAllocation.course.complete
                  ? "Covered"
                  : `Shortfall: £${Math.round(fundAllocation.course.shortfall).toLocaleString()}`}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-600">Coverage source: {fundAllocation.course.sources}</p>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Living Expenses ({livingExpenseRuleLabel})</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="font-medium text-slate-900">£{Math.round(data.summary.livingExpenses || 0).toLocaleString()}</p>
              <p className={`inline-flex items-center gap-1 font-semibold ${fundAllocation.living.complete ? "text-emerald-700" : "text-red-700"}`}>
                {fundAllocation.living.complete ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {fundAllocation.living.complete
                  ? "Covered"
                  : `Shortfall: £${Math.round(fundAllocation.living.shortfall).toLocaleString()}`}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-600">Coverage source: {fundAllocation.living.sources}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Total Required</p>
            <p className="text-base font-semibold text-slate-900">£{Math.round(fundAllocation.totalRequired).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Total Declared</p>
            <p className="text-base font-semibold text-slate-900">£{Math.round(fundAllocation.totalDeclared).toLocaleString()}</p>
          </div>
          <div className={`rounded-lg border p-3 ${fundAllocation.totalGap > 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className="text-xs text-slate-500">Remaining Gap</p>
            <p className={`text-base font-semibold ${fundAllocation.totalGap > 0 ? "text-red-700" : "text-emerald-700"}`}>
              £{Math.round(fundAllocation.totalGap).toLocaleString()}
            </p>
          </div>
        </div>

        {fundAllocation.totalGap > 0 ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            ❌ Funding gap of £{Math.round(fundAllocation.totalGap).toLocaleString()} remaining. You cannot proceed until all funding is proven. Please add more funding sources.
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            ✅ All funding requirements met. You have sufficient funds for your visa application.
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <a href="#funding-sources" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Previous
          </a>
          <a href="#general-documents" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Continue
          </a>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Additional Deposit Receipt (Optional)</h3>
        <p className="mt-1 text-sm text-slate-500">Upload a second or subsequent deposit receipt if you have made more than one deposit payment.</p>
        <div className="mt-4">
          <ChecklistUploadZone
            onFileSelected={uploadDepositReceipt}
            uploading={uploading}
            studentId={data.studentId}
            checklistItemName="Additional Deposit Receipt"
            documentField={`finance:deposit-receipt:${applicationId}`}
            documentType="FINANCIAL_PROOF"
          />
        </div>
      </section>

      <section id="general-documents" className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Source of Funds Documents (Optional)</h3>
        <div className="mt-4 space-y-3">
          {(data.generalDocuments || []).map((item) => {
              const isDone = item.status === "DONE";

              return (
                <div key={item.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (isDone) return;
                        setActiveGeneralDocKey((prev) => (prev === item.key ? null : item.key));
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        isDone
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      {isDone ? "Done" : "To Do"}
                    </button>
                  </div>

                  {!isDone && activeGeneralDocKey === item.key && (
                    <div className="mt-3 space-y-3">
                      <ChecklistUploadZone
                        onFileSelected={(file) => uploadGeneralDocument(item.key, file)}
                        uploading={uploadingGeneralDocKey === item.key}
                        compact
                        studentId={data.studentId}
                        checklistItemName={item.label}
                        documentField={`finance:general:${applicationId}:${item.key}`}
                        documentType={item.uploadDocumentType || "OTHER"}
                      />
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Uploaded Finance Documents</h3>
        {(data.generalDocumentUploads || []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No finance support documents uploaded yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {(data.generalDocumentUploads || []).map((doc) => (
              <div key={`${doc.documentId}-${doc.uploadedAt}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{doc.context?.customLabel || doc.key.replaceAll("_", " ")}</p>
                    <p className="text-xs text-slate-500">Uploaded: {new Date(doc.uploadedAt).toLocaleDateString("en-GB")} • Status: {doc.reviewStatus}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={toApiFilesPath(doc.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Preview
                    </a>
                    <a
                      href={toApiFilesDownloadPath(doc.fileUrl)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => void deleteFinanceDocument(doc.documentId)}
                      disabled={deletingFinanceDocId === doc.documentId}
                      className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      {deletingFinanceDocId === doc.documentId ? "Deleting..." : "Delete"}
                    </button>
                    {data.permissions?.canReviewFinanceDocuments && (
                      <>
                        <button
                          type="button"
                          onClick={() => void reviewFinanceDocument(doc.documentId, "APPROVE")}
                          disabled={reviewingFinanceDocId === doc.documentId}
                          className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewFinanceDocument(doc.documentId, "REJECT")}
                          disabled={reviewingFinanceDocId === doc.documentId}
                          className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex w-full items-center justify-between text-left"
        >
          <h3 className="text-lg font-semibold text-gray-900">Country-Specific Rules ({data.rules.active.countryName})</h3>
          {collapsed ? <ChevronDown className="h-5 w-5 text-slate-600" /> : <ChevronUp className="h-5 w-5 text-slate-600" />}
        </button>
        {!collapsed && (
          <div className="mt-4 space-y-4 text-sm text-slate-700">
            {(data.rules.all || [])
              .filter((entry) => ["UK", "CA", "AU"].includes(entry.countryCode))
              .map((entry) => (
                <div key={entry.countryCode} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-semibold text-slate-900">{entry.countryName}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-6">
                    {entry.rules.map((rule, idx) => (
                      <li key={`${entry.countryCode}-${idx}`}>{rule}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
