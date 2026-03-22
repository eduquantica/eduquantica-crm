-- CreateTable
CREATE TABLE "CounsellorRoundRobin" (
    "id" SERIAL NOT NULL,
    "lastAssignedCounsellorId" TEXT,

    CONSTRAINT "CounsellorRoundRobin_pkey" PRIMARY KEY ("id")
);
