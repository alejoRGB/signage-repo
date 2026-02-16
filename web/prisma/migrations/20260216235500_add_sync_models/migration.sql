-- CreateEnum
CREATE TYPE "SyncPresetMode" AS ENUM ('COMMON', 'PER_DEVICE');

-- CreateEnum
CREATE TYPE "SyncSessionStatus" AS ENUM ('CREATED', 'STARTING', 'WARMING_UP', 'RUNNING', 'STOPPED', 'ABORTED');

-- CreateEnum
CREATE TYPE "SyncSessionDeviceStatus" AS ENUM ('ASSIGNED', 'PRELOADING', 'READY', 'WARMING_UP', 'PLAYING', 'ERRORED', 'DISCONNECTED');

-- AlterTable
ALTER TABLE "MediaItem" ADD COLUMN "durationMs" INTEGER;

-- CreateTable
CREATE TABLE "SyncPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "SyncPresetMode" NOT NULL DEFAULT 'COMMON',
    "durationMs" INTEGER NOT NULL,
    "presetMediaId" TEXT,
    "maxResolution" TEXT,
    "motionIntensity" TEXT,
    "hasText" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncPresetDevice" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "mediaItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncPresetDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncSession" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SyncSessionStatus" NOT NULL DEFAULT 'CREATED',
    "startAtMs" BIGINT,
    "startedAtMs" BIGINT,
    "durationMs" INTEGER NOT NULL,
    "preparationBufferMs" INTEGER NOT NULL DEFAULT 10000,
    "masterDeviceId" TEXT,
    "avgDriftMs" DOUBLE PRECISION,
    "p95DriftMs" DOUBLE PRECISION,
    "p99DriftMs" DOUBLE PRECISION,
    "totalResyncs" INTEGER NOT NULL DEFAULT 0,
    "devicesWithIssues" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),

    CONSTRAINT "SyncSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncSessionDevice" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "SyncSessionDeviceStatus" NOT NULL DEFAULT 'ASSIGNED',
    "lastSeenAt" TIMESTAMP(3),
    "driftHistory" JSONB,
    "resyncCount" INTEGER NOT NULL DEFAULT 0,
    "avgDriftMs" DOUBLE PRECISION,
    "maxDriftMs" DOUBLE PRECISION,
    "resyncRate" DOUBLE PRECISION,
    "clockOffsetMs" DOUBLE PRECISION,
    "cpuTemp" DOUBLE PRECISION,
    "throttled" BOOLEAN NOT NULL DEFAULT false,
    "healthScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncSessionDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncPreset_userId_idx" ON "SyncPreset"("userId");

-- CreateIndex
CREATE INDEX "SyncPreset_presetMediaId_idx" ON "SyncPreset"("presetMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncPresetDevice_presetId_deviceId_key" ON "SyncPresetDevice"("presetId", "deviceId");

-- CreateIndex
CREATE INDEX "SyncPresetDevice_deviceId_idx" ON "SyncPresetDevice"("deviceId");

-- CreateIndex
CREATE INDEX "SyncPresetDevice_mediaItemId_idx" ON "SyncPresetDevice"("mediaItemId");

-- CreateIndex
CREATE INDEX "SyncSession_presetId_idx" ON "SyncSession"("presetId");

-- CreateIndex
CREATE INDEX "SyncSession_userId_status_idx" ON "SyncSession"("userId", "status");

-- CreateIndex
CREATE INDEX "SyncSession_masterDeviceId_idx" ON "SyncSession"("masterDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncSessionDevice_sessionId_deviceId_key" ON "SyncSessionDevice"("sessionId", "deviceId");

-- CreateIndex
CREATE INDEX "SyncSessionDevice_deviceId_status_idx" ON "SyncSessionDevice"("deviceId", "status");

-- CreateIndex
CREATE INDEX "SyncSessionDevice_status_idx" ON "SyncSessionDevice"("status");

-- AddForeignKey
ALTER TABLE "SyncPreset" ADD CONSTRAINT "SyncPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncPreset" ADD CONSTRAINT "SyncPreset_presetMediaId_fkey" FOREIGN KEY ("presetMediaId") REFERENCES "MediaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncPresetDevice" ADD CONSTRAINT "SyncPresetDevice_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "SyncPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncPresetDevice" ADD CONSTRAINT "SyncPresetDevice_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncPresetDevice" ADD CONSTRAINT "SyncPresetDevice_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSession" ADD CONSTRAINT "SyncSession_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "SyncPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSession" ADD CONSTRAINT "SyncSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSession" ADD CONSTRAINT "SyncSession_masterDeviceId_fkey" FOREIGN KEY ("masterDeviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSessionDevice" ADD CONSTRAINT "SyncSessionDevice_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SyncSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncSessionDevice" ADD CONSTRAINT "SyncSessionDevice_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
