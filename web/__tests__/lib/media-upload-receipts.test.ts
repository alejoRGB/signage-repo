/**
 * @jest-environment node
 */
import { del } from "@vercel/blob";
import {
    linkMediaUploadReceiptToMediaItem,
    reconcileMediaUploadReceipts,
    recordVerifiedMediaUploadReceipt,
} from "@/lib/media-upload-receipts";
import { prisma } from "@/lib/prisma";

jest.mock("@vercel/blob", () => ({
    del: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
    prisma: {
        mediaUploadReceipt: {
            upsert: jest.fn(),
            updateMany: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
        mediaItem: {
            findFirst: jest.fn(),
        },
    },
}));

describe("media-upload-receipts", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (del as jest.Mock).mockResolvedValue(undefined);
    });

    it("records verified upload receipt with reconcile window", async () => {
        (prisma.mediaUploadReceipt.upsert as jest.Mock).mockResolvedValue({ id: "r1" });

        await recordVerifiedMediaUploadReceipt({
            userId: "user-1",
            blobUrl: "https://public.blob.vercel-storage.com/media/a.mp4",
            blobPathname: "media/a.mp4",
            blobSize: 1024,
            blobContentType: "video/mp4",
            tokenIssuedAtMs: 123456,
            declaredSize: 1024,
            declaredContentType: "video/mp4",
            receiptData: { source: "test" },
        });

        expect(prisma.mediaUploadReceipt.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({
                    status: "VERIFIED",
                    reconcileAfterAt: expect.any(Date),
                }),
            })
        );
    });

    it("links receipt on media metadata creation", async () => {
        (prisma.mediaUploadReceipt.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

        await linkMediaUploadReceiptToMediaItem({
            userId: "user-1",
            blobUrl: "https://public.blob.vercel-storage.com/media/a.mp4",
            mediaItemId: "media-1",
        });

        expect(prisma.mediaUploadReceipt.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: "user-1",
                    blobUrl: "https://public.blob.vercel-storage.com/media/a.mp4",
                }),
                data: expect.objectContaining({
                    status: "METADATA_LINKED",
                    metadataMediaItemId: "media-1",
                }),
            })
        );
    });

    it("reconciles orphan verified receipts by deleting blob and marking receipt", async () => {
        (prisma.mediaUploadReceipt.findMany as jest.Mock).mockResolvedValue([
            {
                id: "receipt-1",
                userId: "user-1",
                blobUrl: "https://public.blob.vercel-storage.com/media/orphan.mp4",
                status: "VERIFIED",
                metadataLinkedAt: null,
                reconcileAfterAt: new Date(Date.now() - 1000),
                createdAt: new Date(),
            },
        ]);
        (prisma.mediaUploadReceipt.update as jest.Mock).mockResolvedValue({});
        (prisma.mediaItem.findFirst as jest.Mock).mockResolvedValue(null);

        const result = await reconcileMediaUploadReceipts(10);

        expect(result).toEqual(
            expect.objectContaining({
                processed: 1,
                deleted: 1,
            })
        );
        expect(del).toHaveBeenCalledWith("https://public.blob.vercel-storage.com/media/orphan.mp4");
        expect(prisma.mediaUploadReceipt.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "receipt-1" },
                data: expect.objectContaining({
                    status: "ORPHAN_DELETED",
                    orphanDeletedAt: expect.any(Date),
                }),
            })
        );
    });
});

