-- AlterTable
ALTER TABLE "SubAgent" ADD COLUMN     "businessEmail" TEXT,
ADD COLUMN     "expectedMonthlySubmissions" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "heardAboutUs" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "primaryDialCode" TEXT,
ADD COLUMN     "registrationDocUrl" TEXT,
ADD COLUMN     "roleAtAgency" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;
