import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const playlist = await prisma.playlist.findUnique({
        where: {
            id: id,
            userId: session.user.id,
        },
        include: {
            items: {
                include: {
                    mediaItem: true,
                },
                orderBy: {
                    order: "asc",
                },
            },
        },
    });

    if (!playlist) {
        return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    return NextResponse.json(playlist);
}

export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await context.params;
        const payload = await request.json() as {
            name?: unknown;
            items?: unknown;
            orientation?: unknown;
        };
        const { name, items, orientation } = payload;
        type PlaylistItemInput = { mediaItemId: string; duration?: number };

        // Debug logging removed

        const playlistId = id;

        // Verify ownership and get current type
        const existing = await prisma.playlist.findUnique({
            where: { id: playlistId, userId: session.user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const normalizedItems = Array.isArray(items)
            ? items.filter((item): item is PlaylistItemInput => {
                if (typeof item !== "object" || item === null) return false;
                const candidate = item as { mediaItemId?: unknown; duration?: unknown };
                return (
                    typeof candidate.mediaItemId === "string"
                    && (candidate.duration === undefined || typeof candidate.duration === "number")
                );
            })
            : null;

        if (Array.isArray(items) && normalizedItems && normalizedItems.length !== items.length) {
            return NextResponse.json({ error: "Invalid playlist items payload" }, { status: 400 });
        }

        // VALIDATION: Check content compatibility
        if (normalizedItems && normalizedItems.length > 0) {
            const mediaItemIds = Array.from(
                new Set(
                    normalizedItems
                        .map((i) => (typeof i.mediaItemId === "string" ? i.mediaItemId : null))
                        .filter((id: string | null): id is string => !!id)
                )
            );

            if (mediaItemIds.length === 0 && normalizedItems.length > 0) {
                return NextResponse.json({ error: "Invalid playlist items payload" }, { status: 400 });
            }

            const mediaItems = await prisma.mediaItem.findMany({
                where: {
                    id: { in: mediaItemIds },
                    userId: session.user.id,
                },
                select: { id: true, type: true },
            });

            if (mediaItems.length !== mediaItemIds.length) {
                return NextResponse.json(
                    { error: "One or more media items are invalid or unauthorized" },
                    { status: 403 }
                );
            }

            const mediaMap = new Map(mediaItems.map(m => [m.id, m.type]));

            for (const item of normalizedItems) {
                const type = mediaMap.get(item.mediaItemId);
                if (!type) continue;

                if (existing.type === 'web' && type !== 'web') {
                    return NextResponse.json({ error: "Cannot add non-web items to a Web Playlist" }, { status: 400 });
                }
                if (existing.type === 'media' && type === 'web') {
                    return NextResponse.json({ error: "Cannot add web items to a Media Playlist" }, { status: 400 });
                }
            }
        }

        // Transaction to update
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 1. Update details
            const updateData: Prisma.PlaylistUncheckedUpdateInput = {};
            if (typeof name === "string" && name.trim().length > 0) updateData.name = name;

            // Allow updating orientation for all playlists
            if (typeof orientation === "string" && orientation.length > 0) {
                updateData.orientation = orientation;
            }

            if (Object.keys(updateData).length > 0) {
                await tx.playlist.update({
                    where: { id: playlistId },
                    data: updateData,
                });
            }

            // 2. Update items (Replace all)
            if (normalizedItems) {
                // Delete existing
                await tx.playlistItem.deleteMany({
                    where: { playlistId: playlistId },
                });

                // Create new
                const createData = normalizedItems.map((item, index: number) => ({
                    playlistId: playlistId,
                    mediaItemId: item.mediaItemId,
                    order: index,
                    duration: typeof item.duration === "number" ? item.duration : 10,
                }));

                if (createData.length > 0) {
                    await tx.playlistItem.createMany({
                        data: createData,
                    });
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Update playlist error details:", error);
        return NextResponse.json(
            { error: "Failed to update playlist" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await context.params;
        const result = await prisma.playlist.deleteMany({
            where: {
                id: id,
                userId: session.user.id,
            },
        });

        if (result.count === 0) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { error: "Failed to delete" },
            { status: 500 }
        );
    }
}
