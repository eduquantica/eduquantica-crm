-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('ACCOMMODATION', 'JOB_INTERNSHIP', 'AIRPORT_PICKUP', 'HEALTH_INSURANCE', 'BANK_ACCOUNT', 'SIM_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceAppStatus" AS ENUM ('ENQUIRED', 'REFERRED', 'SHORTLISTED', 'OFFERED', 'CONFIRMED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ServiceCommStatus" AS ENUM ('PENDING', 'INVOICED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('SENT', 'CLICKED', 'ENQUIRED', 'SHORTLISTED', 'PLACED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ServicePaymentType" AS ENUM ('AIRPORT_PICKUP', 'ACCOMMODATION_DEPOSIT', 'PRE_DEPARTURE_EVENT', 'OTHER_SERVICE');

-- CreateEnum
CREATE TYPE "ServicePayStatus" AS ENUM ('PENDING', 'PROOF_UPLOADED', 'CONFIRMED', 'REJECTED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ASSIGNED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('PENDING', 'ATTENDING', 'NOT_ATTENDING', 'MAYBE');

-- DropIndex
DROP INDEX "PLExpense_expenseType_idx";

-- DropIndex
DROP INDEX "PLIncome_source_idx";

-- CreateTable
CREATE TABLE "ServiceProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL,
    "logo" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL,
    "description" TEXT,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "agreementStart" TIMESTAMP(3),
    "agreementEnd" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "agreementSigned" BOOLEAN NOT NULL DEFAULT false,
    "agreementDocUrl" TEXT,
    "commissionProtected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceListing" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "priceType" TEXT,
    "availableFrom" TIMESTAMP(3),
    "availableTo" TIMESTAMP(3),
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "amenities" TEXT[],
    "images" TEXT[],
    "isFullyFurnished" BOOLEAN NOT NULL DEFAULT false,
    "isBillsIncluded" BOOLEAN NOT NULL DEFAULT false,
    "jobTitle" TEXT,
    "jobType" TEXT,
    "jobSector" TEXT,
    "salaryMin" DOUBLE PRECISION,
    "salaryMax" DOUBLE PRECISION,
    "hoursPerWeek" INTEGER,
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "eligibleNationalities" TEXT[],
    "eligibleStudyLevels" TEXT[],
    "applicationDeadline" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceApplication" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "status" "ServiceAppStatus" NOT NULL DEFAULT 'ENQUIRED',
    "studentNote" TEXT,
    "adminNote" TEXT,
    "placementConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "placementDate" TIMESTAMP(3),
    "commissionEarned" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCommission" (
    "id" TEXT NOT NULL,
    "serviceAppId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "rate" DOUBLE PRECISION NOT NULL,
    "status" "ServiceCommStatus" NOT NULL DEFAULT 'PENDING',
    "invoicedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceReferral" (
    "id" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'SENT',
    "studentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "providerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "followUpSentAt" TIMESTAMP(3),
    "placementConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "placementDate" TIMESTAMP(3),
    "commissionDue" DOUBLE PRECISION,
    "commissionStatus" "ServiceCommStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePayment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "serviceType" "ServicePaymentType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" "ServicePayStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "paymentProofUrl" TEXT,
    "paymentProofName" TEXT,
    "invoiceNumber" TEXT,
    "invoiceUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "rejectionReason" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePricing" (
    "id" TEXT NOT NULL,
    "serviceType" "ServicePaymentType" NOT NULL,
    "name" TEXT NOT NULL,
    "airport" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirportPickupBooking" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "applicationId" TEXT,
    "destinationCity" TEXT NOT NULL,
    "destinationCountry" TEXT NOT NULL,
    "airport" TEXT NOT NULL,
    "terminal" TEXT,
    "flightNumber" TEXT NOT NULL,
    "departureCountry" TEXT NOT NULL,
    "departureCity" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "departureTime" TEXT NOT NULL,
    "arrivalDate" TIMESTAMP(3) NOT NULL,
    "arrivalTime" TEXT NOT NULL,
    "ticketConfirmationUrl" TEXT,
    "ticketFileName" TEXT,
    "passengerCount" INTEGER NOT NULL DEFAULT 1,
    "specialRequirements" TEXT,
    "status" "PickupStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirportPickupBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreDepartureEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "venueAddress" TEXT,
    "onlineLink" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "organiserUserId" TEXT NOT NULL,
    "targetCountry" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "maxAttendees" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreDepartureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventInvitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "rsvpStatus" "RsvpStatus" NOT NULL DEFAULT 'PENDING',
    "rsvpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCommission_serviceAppId_key" ON "ServiceCommission"("serviceAppId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceReferral_referralCode_key" ON "ServiceReferral"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePayment_invoiceNumber_key" ON "ServicePayment"("invoiceNumber");

-- AddForeignKey
ALTER TABLE "ServiceListing" ADD CONSTRAINT "ServiceListing_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceApplication" ADD CONSTRAINT "ServiceApplication_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ServiceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCommission" ADD CONSTRAINT "ServiceCommission_serviceAppId_fkey" FOREIGN KEY ("serviceAppId") REFERENCES "ServiceApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCommission" ADD CONSTRAINT "ServiceCommission_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReferral" ADD CONSTRAINT "ServiceReferral_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ServiceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReferral" ADD CONSTRAINT "ServiceReferral_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PreDepartureEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PreDepartureEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
