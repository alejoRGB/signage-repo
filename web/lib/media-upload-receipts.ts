import { del } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MEDIA_UPLOAD_RECEIPT_STATUS = {
    RECEIVED: "RECEIVED",
    VERIFIED: "VERIFIED",
    REJECTED: "REJECTED",
    METADATA_LINKED: "METADATA_LINKED",
    ORPHAN_DELETED: "ORPHAN_DELETED",
    RECONCILE_ERROR: "RECONCILE_ERROR",
} as const;

function getMediaUploadReconcileGraceMs() {
    const raw = process.env.MEDIA_UPLOAD_RECONCILE_GRACE_MS?.trim();
    if (!raw) return 15 * 60_000;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 15 * 60_000;
    return Math.min(24 * 60 * 60_000, Math.max(60_000, Math.round(parsed)));
}

function isVercelBlobUrl(url: string) {
    return url.includes("public.blob.vercel-storage.com");
}

function toReceiptJson(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined {
    if (!value) {
        return undefined;
    }
    return value as Prisma.InputJsonValue;
}

type BaseReceiptInput = {
    userId: string;
    blobUrl: string;
    blobPathname: string;
    blobSize: number;
    blobContentType?: string | null;
    tokenIssuedAtMs?: number | null;
    declaredSize?: number | null;
    declaredContentType?: string | null;
    receiptData?: Record<string, unknown> | null;
};

export async function recordVerifiedMediaUploadReceipt(input: BaseReceiptInput) {
    const reconcileAfterAt = new Date(Date.now() + getMediaUploadReconcileGraceMs());
    return prisma.mediaUploadReceipt.upsert({
        where: { blobUrl: input.blobUrl },
        create: {
            userId: input.userId,
            blobUrl: input.blobUrl,
            blobPathname: input.blobPathname,
            blobSize: BigInt(Math.max(0, Math.round(input.blobSize))),
            blobContentType: input.blobContentType ?? null,
            status: MEDIA_UPLOAD_RECEIPT_STATUS.VERIFIED,
            tokenIssuedAtMs:
                typeof input.tokenIssuedAtMs === "number" && Number.isSafeInteger(input.tokenIssuedAtMs)
                    ? BigInt(input.tokenIssuedAtMs)
                    : null,
            declaredSize:
                typeof input.declaredSize === "number" && Number.isFinite(input.declaredSize)
                    ? Math.max(0, Math.round(input.declaredSize))
                    : null,
            declaredContentType: input.declaredContentType ?? null,
            reconcileAfterAt,
            receiptData: toReceiptJson(input.receiptData),
            verificationError: null,
        },
        update: {
            userId: input.userId,
            blobPathname: input.blobPathname,
            blobSize: BigInt(Math.max(0, Math.round(input.blobSize))),
            blobContentType: input.blobContentType ?? null,
            status: MEDIA_UPLOAD_RECEIPT_STATUS.VERIFIED,
            tokenIssuedAtMs:
                typeof input.tokenIssuedAtMs === "number" && Number.isSafeInteger(input.tokenIssuedAtMs)
                    ? BigInt(input.tokenIssuedAtMs)
                    : null,
            declaredSize:
                typeof input.declaredSize === "number" && Number.isFinite(input.declaredSize)
                    ? Math.max(0, Math.round(input.declaredSize))
                    : null,
            declaredContentType: input.declaredContentType ?? null,
            reconcileAfterAt,
            receiptData: toReceiptJson(input.receiptData),
            verificationError: null,
            lastReconcileAttemptAt: null,
            orphanDeletedAt: null,
        },
    });
}

export async function recordRejectedMediaUploadReceipt(
    input: BaseReceiptInput & { error: string; deletedBlob?: boolean }
) {
    return prisma.mediaUploadReceipt.upsert({
        where: { blobUrl: input.blobUrl },
        create: {
            userId: input.userId,
            blobUrl: input.blobUrl,
            blobPathname: input.blobPathname,
            blobSize: BigInt(Math.max(0, Math.round(input.blobSize))),
            blobContentType: input.blobContentType ?? null,
            status: MEDIA_UPLOAD_RECEIPT_STATUS.REJECTED,
            tokenIssuedAtMs:
                typeof input.tokenIssuedAtMs === "number" && Number.isSafeInteger(input.tokenIssuedAtMs)
                    ? BigInt(input.tokenIssuedAtMs)
                    : null,
            declaredSize:
                typeof input.declaredSize === "number" && Number.isFinite(input.declaredSize)
                    ? Math.max(0, Math.round(input.declaredSize))
                    : null,
            declaredContentType: input.declaredContentType ?? null,
            verificationError: input.error.slice(0, 1000),
            orphanDeletedAt: input.deletedBlob ? new Date() : null,
            receiptData: toReceiptJson({ ...(input.receiptData ?? {}), deletedBlob: !!input.deletedBlob }),
        },
        update: {
            status: MEDIA_UPLOAD_RECEIPT_STATUS.REJECTED,
            verificationError: input.error.slice(0, 1000),
            orphanDeletedAt: input.deletedBlob ? new Date() : null,
            receiptData: toReceiptJson({ ...(input.receiptData ?? {}), deletedBlob: !!input.deletedBlob }),
        },
    });
}

export async function linkMediaUploadReceiptToMediaItem(params: {
    userId: string;
    blobUrl: string;
    mediaItemId: string;
}) {
    return prisma.mediaUploadReceipt.updateMany({
        where: {
            userId: params.userId,
            blobUrl: params.blobUrl,
            status: { in: [MEDIA_UPLOAD_RECEIPT_STATUS.VERIFIED, MEDIA_UPLOAD_RECEIPT_STATUS.RECONCILE_ERROR] },
        },
        data: {
            status: MEDIA_UPLOAD_RECEIPT_STATUS.METADATA_LINKED,
            metadataMediaItemId: params.mediaItemId,
            metadataLinkedAt: new Date(),
            verificationError: null,
        },
    });
}

export async function reconcileMediaUploadReceipts(limit = 25) {
    const take = Math.min(100, Math.max(1, Math.round(limit)));
    const now = new Date();
    const candidates = await prisma.mediaUploadReceipt.findMany({
        where: {
            status: { in: [MEDIA_UPLOAD_RECEIPT_STATUS.VERIFIED, MEDIA_UPLOAD_RECEIPT_STATUS.RECONCILE_ERROR] },
            metadataLinkedAt: null,
            reconcileAfterAt: { lte: now },
        },
        orderBy: [{ reconcileAfterAt: "asc" }, { createdAt: "asc" }],
        take,
    });

    let processed = 0;
    let linked = 0;
    let deleted = 0;
    let errors = 0;
    let skipped = 0;

    for (const receipt of candidates) {
        processed += 1;
        try {
            await prisma.mediaUploadReceipt.update({
                where: { id: receipt.id },
                data: { lastReconcileAttemptAt: new Date() },
            });

            const existingMedia = await prisma.mediaItem.findFirst({
                where: {
                    userId: receipt.userId,
                    url: receipt.blobUrl,
                },
                select: { id: true },
            });

            if (existingMedia) {
                linked += 1;
                await prisma.mediaUploadReceipt.update({
                    where: { id: receipt.id },
                    data: {
                        status: MEDIA_UPLOAD_RECEIPT_STATUS.METADATA_LINKED,
                        metadataMediaItemId: existingMedia.id,
                        metadataLinkedAt: new Date(),
                        verificationError: null,
                    },
                });
                continue;
            }

            if (!isVercelBlobUrl(receipt.blobUrl)) {
                skipped += 1;
                await prisma.mediaUploadReceipt.update({
                    where: { id: receipt.id },
                    data: {
                        status: MEDIA_UPLOAD_RECEIPT_STATUS.RECONCILE_ERROR,
                        verificationError: "non_vercel_blob_url",
                    },
                });
                continue;
            }

            await del(receipt.blobUrl);
            deleted += 1;
            await prisma.mediaUploadReceipt.update({
                where: { id: receipt.id },
                data: {
                    status: MEDIA_UPLOAD_RECEIPT_STATUS.ORPHAN_DELETED,
                    orphanDeletedAt: new Date(),
                    verificationError: null,
                },
            });
        } catch (error) {
            errors += 1;
            await prisma.mediaUploadReceipt.update({
                where: { id: receipt.id },
                data: {
                    status: MEDIA_UPLOAD_RECEIPT_STATUS.RECONCILE_ERROR,
                    verificationError:
                        error instanceof Error ? error.message.slice(0, 1000) : "reconcile_error",
                },
            });
        }
    }

    return { processed, linked, deleted, errors, skipped };
}
