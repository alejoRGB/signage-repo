CREATE TABLE "ContactLeadJob" (
  "id" TEXT NOT NULL,
  "lead" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "emailed" BOOLEAN NOT NULL DEFAULT false,
  "forwarded" BOOLEAN NOT NULL DEFAULT false,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactLeadJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactLeadJob_status_nextAttemptAt_createdAt_idx"
ON "ContactLeadJob"("status", "nextAttemptAt", "createdAt");

CREATE INDEX "ContactLeadJob_createdAt_idx"
ON "ContactLeadJob"("createdAt");

CREATE TABLE "MediaUploadReceipt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "blobUrl" TEXT NOT NULL,
  "blobPathname" TEXT NOT NULL,
  "blobSize" BIGINT NOT NULL,
  "blobContentType" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "tokenIssuedAtMs" BIGINT,
  "declaredSize" INTEGER,
  "declaredContentType" TEXT,
  "verificationError" TEXT,
  "metadataMediaItemId" TEXT,
  "metadataLinkedAt" TIMESTAMP(3),
  "reconcileAfterAt" TIMESTAMP(3),
  "lastReconcileAttemptAt" TIMESTAMP(3),
  "orphanDeletedAt" TIMESTAMP(3),
  "receiptData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaUploadReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaUploadReceipt_blobUrl_key"
ON "MediaUploadReceipt"("blobUrl");

CREATE INDEX "MediaUploadReceipt_userId_createdAt_idx"
ON "MediaUploadReceipt"("userId", "createdAt");

CREATE INDEX "MediaUploadReceipt_status_reconcileAfterAt_createdAt_idx"
ON "MediaUploadReceipt"("status", "reconcileAfterAt", "createdAt");

CREATE INDEX "MediaUploadReceipt_userId_blobPathname_idx"
ON "MediaUploadReceipt"("userId", "blobPathname");
