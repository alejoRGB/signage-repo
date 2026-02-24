ALTER TABLE "SyncSessionDevice"
ADD COLUMN "lastRuntimeSentAtMs" BIGINT;

CREATE INDEX "SyncSessionDevice_sessionId_lastRuntimeSentAtMs_idx"
ON "SyncSessionDevice"("sessionId", "lastRuntimeSentAtMs");
