-- AlterTable
ALTER TABLE "ServiceProvider" ADD COLUMN     "agreementSignedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ServiceReferral" ADD COLUMN     "clickedAt" TIMESTAMP(3),
ADD COLUMN     "commissionPaidAt" TIMESTAMP(3),
ADD COLUMN     "providerConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "studentConfirmedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "ServiceReferral" ADD CONSTRAINT "ServiceReferral_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
