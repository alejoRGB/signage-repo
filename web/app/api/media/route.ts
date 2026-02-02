import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";


export async function GET(request: Request) {
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
    } catch (error) {
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
        // 1. Find the item to get filename
        const mediaItem = await prisma.mediaItem.findUnique({
            where: {
                id: id,
                userId: session.user.id, // Ensure ownership
            },
        });

        if (!mediaItem) {
            return NextResponse.json({ error: "Media not found" }, { status: 404 });
        }

        // 2. Delete related PlaylistItems (Manual Cascade)
        await prisma.playlistItem.deleteMany({
            where: { mediaItemId: id },
        });

        // 3. Delete from DB
        await prisma.mediaItem.delete({
            where: { id: id },
        });

        // 3. Delete from Blob Storage (if URL exists and is a blob URL)
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
        const { name, url, type, filename, width, height, fps, size, duration, cacheForOffline } = body;

        if (!name || !url || !type) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const mediaItem = await prisma.mediaItem.create({
            data: {
                name,
                url,
                type,
                filename,
                width: width ? parseInt(width) : null,
                height: height ? parseInt(height) : null,
                fps: fps ? parseFloat(fps) : null,
                size: size ? parseInt(size) : 0,
                duration: duration ? parseInt(duration) : 10,
                cacheForOffline: cacheForOffline || false,
                orientation: body.orientation || "landscape",
                userId: session.user.id,
            },
        });

        return NextResponse.json(mediaItem);
    } catch (error) {
        console.error("Create media error:", error);
        return NextResponse.json(
            { error: "Failed to create media record" },
            { status: 500 }
        );
    }
}
