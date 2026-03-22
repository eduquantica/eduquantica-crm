-- CreateTable
CREATE TABLE "PostEnrolmentService" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "accommodationStatus" TEXT NOT NULL DEFAULT 'NOT_ARRANGED',
    "accommodationType" TEXT,
    "accommodationAddress" TEXT,
    "accommodationMoveInDate" TIMESTAMP(3),
    "accommodationNotes" TEXT,
    "airportRequired" BOOLEAN NOT NULL DEFAULT false,
    "airportStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "airportArrivalDateTime" TIMESTAMP(3),
    "airportFlightNumber" TEXT,
    "airportPickupArrangedBy" TEXT,
    "airportContactNumber" TEXT,
    "airportNotes" TEXT,
    "briefingStatus" TEXT NOT NULL DEFAULT 'NOT_SCHEDULED',
    "briefingDateTime" TIMESTAMP(3),
    "briefingNotes" TEXT,
    "feedbackStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
    "feedbackToken" TEXT,
    "feedbackSentAt" TIMESTAMP(3),
    "feedbackSubmittedAt" TIMESTAMP(3),
    "feedbackOverallSatisfaction" INTEGER,
    "feedbackCounsellorHelpfulness" INTEGER,
    "feedbackApplicationProcess" INTEGER,
    "feedbackWouldRecommend" BOOLEAN,
    "feedbackComments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostEnrolmentService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostEnrolmentService_applicationId_key" ON "PostEnrolmentService"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "PostEnrolmentService_feedbackToken_key" ON "PostEnrolmentService"("feedbackToken");

-- CreateIndex
CREATE INDEX "PostEnrolmentService_studentId_idx" ON "PostEnrolmentService"("studentId");

-- CreateIndex
CREATE INDEX "PostEnrolmentService_feedbackToken_idx" ON "PostEnrolmentService"("feedbackToken");

-- AddForeignKey
ALTER TABLE "PostEnrolmentService" ADD CONSTRAINT "PostEnrolmentService_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostEnrolmentService" ADD CONSTRAINT "PostEnrolmentService_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
