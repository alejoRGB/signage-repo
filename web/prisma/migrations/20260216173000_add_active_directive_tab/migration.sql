-- CreateEnum
CREATE TYPE "DirectiveTab" AS ENUM ('SCHEDULES', 'SYNC_VIDEOWALL');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "activeDirectiveTab" "DirectiveTab" NOT NULL DEFAULT 'SCHEDULES';
