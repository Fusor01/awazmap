-- CreateEnum
CREATE TYPE "InputSource" AS ENUM ('VOICE', 'TEXT');

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "durationDays" INTEGER,
ADD COLUMN     "durationText" TEXT,
ADD COLUMN     "previousComplaint" BOOLEAN,
ADD COLUMN     "severityReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "source" "InputSource" NOT NULL DEFAULT 'VOICE';
