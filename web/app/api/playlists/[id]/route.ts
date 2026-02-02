import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: Request,
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
        const json = await request.json();
        const { name, items } = json;

        // DEBUG LOGGING
        const fs = require('fs');
        const logData = `\n[${new Date().toISOString()}] PUT /api/playlists/${id}\nParams ID: ${id}\nPayload: ${JSON.stringify(json, null, 2)}\n`;
        try { fs.appendFileSync('debug_playlist.txt', logData); } catch (e) { }

        const playlistId = id;

        // Verify ownership
        const existing = await prisma.playlist.findUnique({
            where: { id: playlistId, userId: session.user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Transaction to update
        await prisma.$transaction(async (tx: any) => {
            // 1. Update details
            if (name) {
                await tx.playlist.update({
                    where: { id: playlistId },
                    data: { name },
                });
            }

            // 2. Update items (Replace all)
            if (items && Array.isArray(items)) {
                // Delete existing
                await tx.playlistItem.deleteMany({
                    where: { playlistId: playlistId },
                });

                // Create new
                const createData = items.map((item: any, index: number) => ({
                    playlistId: playlistId,
                    mediaItemId: item.mediaItemId,
                    order: index,
                    duration: item.duration || 10,
                }));

                if (createData.length > 0) {
                    await tx.playlistItem.createMany({
                        data: createData,
                    });
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        const fs = require('fs');
        try { fs.appendFileSync('debug_playlist.txt', `ERROR: ${error.message}\nStack: ${error.stack}\n`); } catch (e) { }

        console.error("Update playlist error details:", error);
        return NextResponse.json(
            { error: "Failed to update playlist", details: error.message || String(error) },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
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
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to delete" },
            { status: 500 }
        );
    }
}
