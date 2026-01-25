-- CreateTable
CREATE TABLE "WatchdogEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "restartCount" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchdogEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WatchdogEvent_deviceId_idx" ON "WatchdogEvent"("deviceId");

-- CreateIndex
CREATE INDEX "WatchdogEvent_timestamp_idx" ON "WatchdogEvent"("timestamp");
