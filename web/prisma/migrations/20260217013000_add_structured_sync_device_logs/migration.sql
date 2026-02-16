-- AlterTable
ALTER TABLE "DeviceLog"
ADD COLUMN "event" TEXT,
ADD COLUMN "sessionId" TEXT,
ADD COLUMN "data" JSONB;

-- CreateIndex
CREATE INDEX "DeviceLog_deviceId_createdAt_idx" ON "DeviceLog"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "DeviceLog_deviceId_sessionId_createdAt_idx" ON "DeviceLog"("deviceId", "sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "DeviceLog_deviceId_event_createdAt_idx" ON "DeviceLog"("deviceId", "event", "createdAt");
