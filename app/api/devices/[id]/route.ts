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

    const device = await prisma.device.findFirst({
        where: {
            id: id,
            userId: session.user.id,
        },
        include: {
            activePlaylist: true,
        },
    });

    if (!device) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    return NextResponse.json(device);
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
        const { name, activePlaylistId } = json;

        // Verify ownership
        const existing = await prisma.device.findFirst({
            where: { id: id, userId: session.user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // If activePlaylistId is provided, verify it belongs to user
        if (activePlaylistId) {
            const playlist = await prisma.playlist.findFirst({
                where: {
                    id: activePlaylistId,
                    userId: session.user.id,
                },
            });

            if (!playlist) {
                return NextResponse.json(
                    { error: "Playlist not found" },
                    { status: 404 }
                );
            }
        }

        const device = await prisma.device.update({
            where: { id: id },
            data: {
                ...(name && { name }),
                ...(activePlaylistId !== undefined && { activePlaylistId }),
            },
            include: {
                activePlaylist: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json(device);
    } catch (error) {
        console.error("Update device error:", error);
        return NextResponse.json(
            { error: "Failed to update device" },
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

        const result = await prisma.device.deleteMany({
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
        console.error("Delete device error:", error);
        return NextResponse.json(
            { error: "Failed to delete" },
            { status: 500 }
        );
    }
}
