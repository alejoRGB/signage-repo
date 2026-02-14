import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const playlist = await prisma.playlist.findUnique({
            where: { id },
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

        return NextResponse.json(playlist);
    } catch (error) {
        console.error("[DEBUG_PLAYLIST_GET]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
