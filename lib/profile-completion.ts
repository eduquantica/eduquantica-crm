import { db } from "@/lib/db";

export type ProfileCompletionDetails = {
  percentage: number;
  firstIncompleteHref: string;
};

export function getCompletionColor(p: number) {
  if (p === 100) return "bg-emerald-500"; // green
  if (p >= 70) return "bg-blue-500"; // blue
  if (p >= 40) return "bg-amber-400"; // amber
  return "bg-red-500"; // red
}

export async function calculateProfileCompletionDetails(studentId: string): Promise<ProfileCompletionDetails> {
  const [student, academicProfile, documents] = await Promise.all([
    db.student.findUnique({ where: { id: studentId } }),
    db.studentAcademicProfile.findUnique({
      where: { studentId },
      include: { qualifications: true },
    }),
    db.document.findMany({
      where: { studentId },
      include: { scanResult: true },
    }),
  ]);

  if (!student) {
    return {
      percentage: 0,
      firstIncompleteHref: "/student/profile",
    };
  }

  let score = 0;

  const hasName = Boolean(student.firstName && student.lastName);
  const hasEmailPhone = Boolean(student.email && student.phone);
  const hasNationalityCountry = Boolean(student.nationality && student.country);
  const hasPassportInfo = Boolean(student.passportNumber && student.passportExpiry);

  if (hasName) score += 5;
  if (hasEmailPhone) score += 5;
  if (hasNationalityCountry) score += 5;
  if (hasPassportInfo) score += 5;

  const hasAddress = Boolean(student.address && student.city && student.country);
  if (hasAddress) score += 10;

  const qualCount = academicProfile?.qualifications?.length ?? 0;
  const hasQualifications = qualCount > 0;
  if (hasQualifications) score += 15;

  let transcriptConfirmed = false;
  if (academicProfile?.qualifications) {
    for (const q of academicProfile.qualifications) {
      if (q.transcriptDocId && q.ocrConfirmedByStudent) {
        transcriptConfirmed = true;
        break;
      }
      if (q.transcriptDocId) {
        const doc = documents.find((d) => d.id === q.transcriptDocId);
        if (doc && doc.scanResult && doc.scanResult.status === "COMPLETED") {
          transcriptConfirmed = true;
          break;
        }
      }
    }
  }
  if (transcriptConfirmed) score += 15;

  const hasEnglishScores = Boolean(student.englishTestType && student.englishTestScore);
  if (hasEnglishScores) score += 10;

  const hasPassportScan = documents.some((d) => d.type === "PASSPORT");
  if (hasPassportScan) score += 10;

  const academicDocTypes = ["TRANSCRIPT", "DEGREE_CERT", "ENGLISH_TEST"];
  const hasAcademicDoc = documents.some((d) => academicDocTypes.includes(d.type));
  if (hasAcademicDoc) score += 10;

  const hasSOP = documents.some((d) => d.type === "SOP" || d.type === "PERSONAL_STATEMENT");
  if (hasSOP) score += 10;

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let firstIncompleteHref = "/student/profile";
  if (!hasName || !hasEmailPhone || !hasNationalityCountry || !hasPassportInfo) {
    firstIncompleteHref = "/student/profile#personal";
  } else if (!hasAddress) {
    firstIncompleteHref = "/student/profile#address";
  } else if (!hasQualifications || !transcriptConfirmed) {
    firstIncompleteHref = "/student/profile#academic";
  } else if (!hasEnglishScores) {
    firstIncompleteHref = "/student/profile#english";
  } else if (!hasPassportScan || !hasAcademicDoc) {
    firstIncompleteHref = "/student/profile#documents";
  } else if (!hasSOP) {
    firstIncompleteHref = "/student/profile#statement";
  }

  return {
    percentage: score,
    firstIncompleteHref,
  };
}

export async function calculateProfileCompletion(studentId: string): Promise<number> {
  const details = await calculateProfileCompletionDetails(studentId);
  return details.percentage;
}

export default calculateProfileCompletion;
