-- CreateEnum
CREATE TYPE "SyncDeviceCommandType" AS ENUM ('SYNC_PREPARE', 'SYNC_STOP');

-- CreateEnum
CREATE TYPE "SyncDeviceCommandStatus" AS ENUM ('PENDING', 'ACKED', 'FAILED');

-- CreateTable
CREATE TABLE "SyncDeviceCommand" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "SyncDeviceCommandType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SyncDeviceCommandStatus" NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ackedAt" TIMESTAMP(3),

    CONSTRAINT "SyncDeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncDeviceCommand_deviceId_status_createdAt_idx" ON "SyncDeviceCommand"("deviceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SyncDeviceCommand_sessionId_status_idx" ON "SyncDeviceCommand"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SyncDeviceCommand_deviceId_dedupeKey_key" ON "SyncDeviceCommand"("deviceId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "SyncDeviceCommand" ADD CONSTRAINT "SyncDeviceCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncDeviceCommand" ADD CONSTRAINT "SyncDeviceCommand_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SyncSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
