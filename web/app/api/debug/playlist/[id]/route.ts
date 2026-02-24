import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDebugEndpointAccess } from "@/lib/debug-endpoint-access";

export const dynamic = 'force-dynamic';

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    try {
        const denied = await requireDebugEndpointAccess();
        if (denied) {
            return denied;
        }

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
