/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import { scanPassport, scanFinancialDoc, scanGenericDoc, PassportOCRData, FinancialDocOCRData, GenericDocOCRData } from "@/lib/mindee";
import { FraudDetector, FraudRiskLevel, PassportValidationResult, FinancialDocValidationResult } from "@/lib/fraud-detection";
import { sendResendEmail } from "@/lib/resend";

export enum DocumentScanPhase {
  PENDING = "PENDING",
  SCANNING = "SCANNING",
  ANALYZING = "ANALYZING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface DocumentScanResult {
  checklistItemId: string;
  ocrStatus: DocumentScanPhase;
  fraudRiskLevel: string;
  fraudFlags: string[];
  ocrData: Record<string, unknown>;
  ocrConfidence: number;
  validationDetails: Record<string, unknown>;
}

/**
 * Run document scan and fraud detection for a checklist item
 * This function:
 * 1. Fetches document and checklist item data
 * 2. Selects appropriate Mindee scanner based on document type
 * 3. Calls Mindee API to extract OCR data
 * 4. Runs fraud detection validation
 * 5. Updates ChecklistItem with results
 * 6. Creates notifications and tasks for flagged documents
 */
export async function runDocumentScan(checklistItemId: string): Promise<DocumentScanResult> {
  try {
    // Fetch checklist item with relations
    const checklistItem = await db.checklistItem.findUnique({
      where: { id: checklistItemId },
      include: {
        document: true,
        checklist: {
          include: {
            application: {
              include: {
                course: {
                  include: {
                    university: true,
                  },
                },
              },
            },
            student: {
              include: {
                assignedCounsellor: true,
              },
            },
          },
        },
      },
    });

    if (!checklistItem || !checklistItem.document) {
      throw new Error(`ChecklistItem ${checklistItemId} or associated document not found`);
    }

    const { document, checklist } = checklistItem;
    const { student, application } = checklist;
    const documentType = document.type;
    const fileUrl = document.fileUrl;

    // Mark as scanning
    await db.checklistItem.update({
      where: { id: checklistItemId },
      data: { ocrStatus: DocumentScanPhase.SCANNING },
    });

    // Run appropriate scanner based on document type
    let ocrData: any = null;
    let ocrConfidence = 0;

    if (documentType === "PASSPORT") {
      const result = await scanPassport(fileUrl);
      if ("error" in result) {
        throw new Error(result.error);
      }
      ocrData = result;
      ocrConfidence = (result as PassportOCRData).confidence;
    } else if (documentType === "FINANCIAL_PROOF") {
      const result = await scanFinancialDoc(fileUrl);
      if ("error" in result) {
        throw new Error(result.error);
      }
      ocrData = result;
      ocrConfidence = (result as FinancialDocOCRData).confidence;
    } else {
      // Generic document scanner for other types
      const result = await scanGenericDoc(fileUrl);
      if ("error" in result) {
        throw new Error(result.error);
      }
      ocrData = result;
      ocrConfidence = (result as GenericDocOCRData).confidence;
    }

    // Run fraud detection validation
    let validationResult: PassportValidationResult | FinancialDocValidationResult | null = null;
    const fraudFlags: string[] = [];
    let fraudRiskLevel = FraudRiskLevel.LOW;

    if (documentType === "PASSPORT" && "surname" in ocrData) {
      const passportData = ocrData as PassportOCRData;
      const courseEndDate = estimateCourseEndDate(
        application?.createdAt,
        application?.course?.duration,
      );
      validationResult = FraudDetector.validatePassport(passportData, {
        firstName: student.firstName,
        lastName: student.lastName,
        dateOfBirth: student.dateOfBirth,
        passportExpiry: student.passportExpiry,
        courseEndDate,
      });
      fraudRiskLevel = validationResult.riskLevel;
      fraudFlags.push(...validationResult.flags);
    } else if (documentType === "FINANCIAL_PROOF" && "accountHolderName" in ocrData) {
      const financialData = ocrData as FinancialDocOCRData;
      // Calculate required amount based on country and course
      const countryCode = application?.course?.university?.country || "";
      const requiredAmount = getFinancialRequirement(countryCode);

      validationResult = FraudDetector.validateFinancialDoc(
        financialData,
        {
          firstName: student.firstName,
          lastName: student.lastName,
        },
        requiredAmount,
        countryCode,
      );
      fraudRiskLevel = validationResult.riskLevel;
      fraudFlags.push(...validationResult.flags);
    }

    // Update ChecklistItem with OCR results
    await db.checklistItem.update({
      where: { id: checklistItemId },
      data: {
        ocrStatus: DocumentScanPhase.COMPLETED,
        ocrData: ocrData,
        ocrConfidence: ocrConfidence,
        fraudRiskLevel: fraudRiskLevel as any,
        fraudFlags: fraudFlags,
      },
    });

    // Create notifications and tasks based on risk level
    if (fraudRiskLevel === FraudRiskLevel.HIGH) {
      await handleHighRiskDocument(
        student,
        checklist.student.assignedCounsellor,
        document.fileName,
        fraudFlags,
        validationResult?.details,
      );
    } else if (fraudRiskLevel === FraudRiskLevel.MEDIUM) {
      await handleMediumRiskDocument(
        student,
        checklist.student.assignedCounsellor,
        document.fileName,
        fraudFlags,
      );
    }

    // Log the scan
    await db.activityLog.create({
      data: {
        userId: "system",
        entityType: "document",
        entityId: document.id,
        action: "fraud_detection_completed",
        details: `Risk Level: ${fraudRiskLevel}, Flags: ${fraudFlags.join(", ") || "none"}`,
      },
    });

    return {
      checklistItemId,
      ocrStatus: DocumentScanPhase.COMPLETED,
      fraudRiskLevel: fraudRiskLevel,
      fraudFlags: fraudFlags,
      ocrData: ocrData,
      ocrConfidence: ocrConfidence,
      validationDetails: validationResult?.details || {},
    };
  } catch (error) {
    console.error(`Document scan failed for ${checklistItemId}:`, error);

    // Update as failed
    await db.checklistItem.update({
      where: { id: checklistItemId },
      data: { ocrStatus: DocumentScanPhase.FAILED },
    }).catch((e) => console.error("Failed to update failed status:", e));

    throw error;
  }
}

/**
 * Handle high-risk document flagged for potential fraud
 * - Send urgent notification to counsellor and admin
 * - Send urgent email
 * - Create HIGH priority task
 */
async function handleHighRiskDocument(
  student: any,
  assignedCounsellor: any,
  fileName: string,
  fraudFlags: string[],
  validationDetails?: Record<string, unknown>,
) {
  try {
    const admins = await db.user.findMany({
      where: { role: { name: "ADMIN" } },
      select: { id: true, email: true, name: true },
      take: 3,
    });

    const flagsText = fraudFlags.join(", ");
    const studentName = `${student.firstName} ${student.lastName}`;
    const subject = `⚠️ URGENT - High Risk Document Detected for ${studentName}`;

    // Create notification for counsellor
    if (assignedCounsellor) {
      await db.notification.create({
        data: {
          userId: assignedCounsellor.id,
          type: "FRAUD_RISK_HIGH",
          message: `HIGH RISK: ${studentName} - ${fileName}\n${flagsText}`,
          linkUrl: `/dashboard/students/${student.id}/documents`,
        },
      });

      // Send email to counsellor
      await sendResendEmail({
        to: assignedCounsellor.email,
        subject: subject,
        html: `
          <h2 style="color: #dc2626;">⚠️ URGENT DOCUMENT REVIEW REQUIRED</h2>
          <p><strong>Student:</strong> ${studentName}</p>
          <p><strong>Document:</strong> ${fileName}</p>
          <p><strong>Risk Flags:</strong></p>
          <ul>
            ${fraudFlags.map((f) => `<li>${f}</li>`).join("")}
          </ul>
          <p><strong>Validation Details:</strong></p>
          <pre>${JSON.stringify(validationDetails, null, 2)}</pre>
          <p><a href="https://dashboard.eduquantica.com/dashboard/students/${student.id}/documents" style="background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Document</a></p>
        `,
      });

      // Create HIGH priority task for counsellor
      await db.task.create({
        data: {
          userId: assignedCounsellor.id,
          studentId: student.id,
          title: `Review Flagged Document - ${studentName}`,
          description: `HIGH RISK document detected:\n${flagsText}`,
          priority: "HIGH",
          status: "PENDING",
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due in 24 hours
        },
      });
    }

    // Create notification and tasks for all admins
    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: "FRAUD_RISK_HIGH",
          message: `HIGH RISK: ${studentName} - ${fileName}\n${flagsText}`,
          linkUrl: `/dashboard/students/${student.id}/documents`,
        },
      });

      await sendResendEmail({
        to: admin.email,
        subject: subject,
        html: `
          <h2 style="color: #dc2626;">⚠️ URGENT DOCUMENT REVIEW REQUIRED</h2>
          <p><strong>Student:</strong> ${studentName}</p>
          <p><strong>Document:</strong> ${fileName}</p>
          <p><strong>Assigned Counsellor:</strong> ${assignedCounsellor?.name || "N/A"}</p>
          <p><strong>Risk Flags:</strong></p>
          <ul>
            ${fraudFlags.map((f) => `<li>${f}</li>`).join("")}
          </ul>
          <p><a href="https://dashboard.eduquantica.com/dashboard/students/${student.id}/documents" style="background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Document</a></p>
        `,
      });

      await db.task.create({
        data: {
          userId: admin.id,
          studentId: student.id,
          title: `URGENT: Review Flagged Document - ${studentName}`,
          description: `HIGH RISK document detected by fraud detection system:\n${flagsText}${assignedCounsellor ? `\nAssigned Counsellor: ${assignedCounsellor.name}` : ""}`,
          priority: "HIGH",
          status: "PENDING",
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  } catch (error) {
    console.error("Error handling high-risk document:", error);
  }
}

/**
 * Handle medium-risk document
 * - Send normal notification to counsellor
 */
async function handleMediumRiskDocument(
  student: any,
  assignedCounsellor: any,
  fileName: string,
  fraudFlags: string[],
) {
  try {
    if (assignedCounsellor) {
      const studentName = `${student.firstName} ${student.lastName}`;
      const flagsText = fraudFlags.join(", ");

      await db.notification.create({
        data: {
          userId: assignedCounsellor.id,
          type: "FRAUD_RISK_MEDIUM",
          message: `MEDIUM RISK: ${studentName} - ${fileName}\n${flagsText}`,
          linkUrl: `/dashboard/students/${student.id}/documents`,
        },
      });
    }
  } catch (error) {
    console.error("Error handling medium-risk document:", error);
  }
}

/**
 * Get financial requirement based on country
 */
function getFinancialRequirement(country: string): number {
  const countryUpper = country.toUpperCase();

  // Based on UK, Canada, and Australia visa requirements
  switch (countryUpper) {
    case "UK":
    case "UNITED KINGDOM":
      return 21570; // GBP for London area
    case "CANADA":
    case "CA":
      return 31000; // CAD
    case "AUSTRALIA":
    case "AU":
      return 25000; // AUD
    case "USA":
    case "US":
      return 25000; // USD estimated
    default:
      return 20000; // Default conservative estimate
  }
}

function estimateCourseEndDate(
  startDate?: Date | null,
  durationText?: string | null,
): Date | undefined {
  if (!startDate || !durationText) return undefined;

  const duration = durationText.toLowerCase();
  const match = duration.match(/(\d+)/);
  if (!match) return undefined;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;

  const endDate = new Date(startDate);
  if (duration.includes("year")) {
    endDate.setFullYear(endDate.getFullYear() + value);
  } else {
    endDate.setMonth(endDate.getMonth() + value);
  }

  return endDate;
}
