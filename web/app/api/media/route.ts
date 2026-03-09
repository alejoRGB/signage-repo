import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CreateMediaItemSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { assertUserMediaQuotaAvailable } from "@/lib/media-upload-quota";
import { linkMediaUploadReceiptToMediaItem } from "@/lib/media-upload-receipts";
import { Prisma } from "@prisma/client";


export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const mediaItems = await prisma.mediaItem.findMany({
            where: {
                userId: session.user.id,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return NextResponse.json(mediaItems);
    } catch {
        return NextResponse.json(
            { error: "Failed to fetch media" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Media ID required" }, { status: 400 });
    }

    try {
        // Find the media item first to enforce ownership and blob cleanup.
        const mediaItem = await prisma.mediaItem.findFirst({
            where: {
                id: id,
                userId: session.user.id, // Ensure ownership
            },
        });

        if (!mediaItem) {
            return NextResponse.json({ error: "Media not found" }, { status: 404 });
        }

        const blockingPlaylistItem = await prisma.playlistItem.findFirst({
            where: {
                mediaItemId: id,
                playlist: {
                    userId: session.user.id,
                },
            },
            select: {
                id: true,
            },
        });

        if (blockingPlaylistItem) {
            return NextResponse.json(
                {
                    code: "MEDIA_IN_USE",
                    error: "Cannot delete media that is currently used in a playlist",
                },
                { status: 409 }
            );
        }

        // Delete from DB only when the media is no longer referenced by playlists.
        await prisma.mediaItem.delete({
            where: { id: id },
        });

        // Delete from Blob Storage (if URL exists and is a blob URL)
        try {
            if (mediaItem.url && mediaItem.url.includes("public.blob.vercel-storage.com")) {
                await del(mediaItem.url);
            }
        } catch (e) {
            console.warn("Failed to delete file from blob:", e);
            // Continue, as DB record is gone
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
            return NextResponse.json(
                {
                    code: "MEDIA_IN_USE",
                    error: "Cannot delete media that is currently used in a playlist",
                },
                { status: 409 }
            );
        }
        console.error("Delete error:", error);
        return NextResponse.json(
            { error: "Failed to delete media" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();

        const result = CreateMediaItemSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const data = result.data;

        const normalizedDuration = data.duration ?? 10;
        const normalizedDurationMs =
            data.type === "video"
                ? data.durationMs ?? Math.max(1, Math.round(normalizedDuration * 1000))
                : null;
        const incomingSize = Math.max(0, Math.round(data.size ?? 0));

        try {
            await assertUserMediaQuotaAvailable(session.user.id, incomingSize);
        } catch (quotaError) {
            if (data.url && data.url.includes("public.blob.vercel-storage.com")) {
                await del(data.url).catch(() => undefined);
            }
            return NextResponse.json(
                { error: quotaError instanceof Error ? quotaError.message : "Media quota exceeded" },
                { status: 409 }
            );
        }

        const mediaItem = await prisma.mediaItem.create({
            data: {
                name: data.name,
                url: data.url,
                type: data.type,
                filename: data.type === "web" ? null : data.filename ?? null,
                width: data.width ?? undefined,
                height: data.height ?? undefined,
                fps: data.fps ?? undefined,
                size: incomingSize,
                duration: normalizedDuration,
                durationMs: normalizedDurationMs,
                cacheForOffline: data.cacheForOffline ?? false,
                userId: session.user.id,
            },
        });

        if (data.url && data.url.includes("public.blob.vercel-storage.com")) {
            await linkMediaUploadReceiptToMediaItem({
                userId: session.user.id,
                blobUrl: data.url,
                mediaItemId: mediaItem.id,
            }).catch((error) => {
                console.warn("Failed to link media upload receipt:", error);
            });
        }

        return NextResponse.json(mediaItem);
    } catch (error) {
        console.error("Create media error:", error);
        return NextResponse.json(
            { error: "Failed to create media record" },
            { status: 500 }
        );
    }
}
