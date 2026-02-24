import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { del, head } from "@vercel/blob";
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MAX_MEDIA_UPLOAD_SIZE_BYTES } from "@/lib/media-upload-policy";
import { assertUserMediaQuotaAvailable, parseDeclaredUploadClientPayload } from "@/lib/media-upload-quota";
import { prisma } from "@/lib/prisma";
import {
  recordRejectedMediaUploadReceipt,
  recordVerifiedMediaUploadReceipt,
} from "@/lib/media-upload-receipts";

function isSupportedUploadContentType(contentType: string | undefined) {
  if (!contentType) return false;
  return ["image/jpeg", "image/png", "image/gif", "video/mp4", "video/webm"].includes(contentType);
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getServerSession(authOptions);
        if (!session) {
          throw new Error('Unauthorized');
        }
        const declared = parseDeclaredUploadClientPayload(clientPayload);
        if (declared.size !== undefined) {
          if (declared.size > MAX_MEDIA_UPLOAD_SIZE_BYTES) {
            throw new Error("File exceeds 2 GB limit");
          }
          await assertUserMediaQuotaAvailable(session.user.id, declared.size);
        }
        if (declared.contentType && !isSupportedUploadContentType(declared.contentType)) {
          throw new Error("Unsupported content type");
        }
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'],
          maximumSizeInBytes: MAX_MEDIA_UPLOAD_SIZE_BYTES,
          tokenPayload: JSON.stringify({
            userId: session.user.id,
            pathname,
            declaredSize: declared.size ?? null,
            declaredContentType: declared.contentType ?? null,
            issuedAtMs: Date.now(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let parsedTokenPayload: {
          userId?: string;
          pathname?: string;
          declaredSize?: number | null;
          declaredContentType?: string | null;
          issuedAtMs?: number | null;
        } | null = null;

        try {
          parsedTokenPayload = tokenPayload ? JSON.parse(tokenPayload) : null;
        } catch {
          parsedTokenPayload = null;
        }

        const userId = typeof parsedTokenPayload?.userId === "string" ? parsedTokenPayload.userId : null;
        const receiptSeed = {
          userId: userId ?? "unknown",
          blobUrl: blob.url,
          blobPathname: blob.pathname ?? "",
          blobSize: 0,
          blobContentType: blob.contentType ?? null,
          tokenIssuedAtMs:
            typeof parsedTokenPayload?.issuedAtMs === "number" ? parsedTokenPayload.issuedAtMs : null,
          declaredSize:
            typeof parsedTokenPayload?.declaredSize === "number" ? parsedTokenPayload.declaredSize : null,
          declaredContentType:
            typeof parsedTokenPayload?.declaredContentType === "string"
              ? parsedTokenPayload.declaredContentType
              : null,
          receiptData: {
            blobPathname: blob.pathname ?? null,
            callback: "vercel_blob_upload_completed",
          },
        };

        if (!userId) {
          await del(blob.url).catch(() => undefined);
          await recordRejectedMediaUploadReceipt({
            ...receiptSeed,
            error: "Missing upload token user",
            deletedBlob: true,
          }).catch(() => undefined);
          throw new Error("Missing upload token user");
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, isActive: true },
        });

        if (!user || !user.isActive) {
          await del(blob.url).catch(() => undefined);
          await recordRejectedMediaUploadReceipt({
            ...receiptSeed,
            userId,
            error: "Invalid or inactive upload owner",
            deletedBlob: true,
          }).catch(() => undefined);
          throw new Error("Invalid or inactive upload owner");
        }

        const blobHead = await head(blob.url);
        const receiptInput = {
          ...receiptSeed,
          userId,
          blobPathname: blobHead.pathname,
          blobSize: blobHead.size,
          blobContentType: blobHead.contentType ?? null,
          receiptData: {
            callback: "vercel_blob_upload_completed",
            downloadUrl: blobHead.downloadUrl ?? null,
          },
        };

        if (blobHead.size > MAX_MEDIA_UPLOAD_SIZE_BYTES) {
          await del(blob.url).catch(() => undefined);
          await recordRejectedMediaUploadReceipt({
            ...receiptInput,
            error: "Uploaded file exceeds max size",
            deletedBlob: true,
          }).catch(() => undefined);
          throw new Error("Uploaded file exceeds max size");
        }

        if (
          typeof parsedTokenPayload?.pathname === "string" &&
          parsedTokenPayload.pathname.length > 0 &&
          parsedTokenPayload.pathname !== blobHead.pathname
        ) {
          await del(blob.url).catch(() => undefined);
          await recordRejectedMediaUploadReceipt({
            ...receiptInput,
            error: "Uploaded pathname mismatch",
            deletedBlob: true,
          }).catch(() => undefined);
          throw new Error("Uploaded pathname mismatch");
        }

        if (
          typeof parsedTokenPayload?.declaredContentType === "string" &&
          parsedTokenPayload.declaredContentType &&
          parsedTokenPayload.declaredContentType !== blobHead.contentType
        ) {
          await del(blob.url).catch(() => undefined);
          await recordRejectedMediaUploadReceipt({
            ...receiptInput,
            error: "Uploaded content type mismatch",
            deletedBlob: true,
          }).catch(() => undefined);
          throw new Error("Uploaded content type mismatch");
        }

        const existing = await prisma.mediaItem.findFirst({
          where: {
            userId,
            OR: [
              { url: blob.url },
              { filename: blobHead.pathname },
            ],
          },
          select: { id: true, size: true },
        });

        if (!existing) {
          try {
            await assertUserMediaQuotaAvailable(userId, blobHead.size);
          } catch (quotaError) {
            await del(blob.url).catch(() => undefined);
            await recordRejectedMediaUploadReceipt({
              ...receiptInput,
              error: quotaError instanceof Error ? quotaError.message : "Media quota exceeded",
              deletedBlob: true,
            }).catch(() => undefined);
            throw quotaError;
          }
        }

        await recordVerifiedMediaUploadReceipt(receiptInput);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
