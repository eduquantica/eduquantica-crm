import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import StudentServicesClient from './StudentServicesClient'

export default async function StudentServicesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.roleName !== "STUDENT") {
    redirect("/login");
  }

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    redirect("/login");
  }

  const approvedCountries = await db.visaApplication
    .findMany({
      where: { studentId: student.id, status: "APPROVED" },
      select: { country: true },
    })
    .then((items) => Array.from(new Set(items.map((item) => item.country))));

  const isVisaApproved = approvedCountries.length > 0;
  const pricing = await db.servicePricing.findMany({
    where: { serviceType: "AIRPORT_PICKUP", isActive: true },
    select: { id: true, airport: true, name: true, amount: true, currency: true },
    orderBy: { createdAt: "desc" },
  });

  const bankDetails = {
    accountName: process.env.BANK_ACCOUNT_NAME || "",
    bankName: process.env.BANK_NAME || "",
    sortCode: process.env.BANK_SORT_CODE || "",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || "",
    iban: process.env.BANK_IBAN || "",
  };

  return (
    <StudentServicesClient
      studentId={student.id}
      isVisaApproved={isVisaApproved}
      approvedCountries={approvedCountries}
      pricing={pricing}
      bankDetails={bankDetails}
    />
  );
}
