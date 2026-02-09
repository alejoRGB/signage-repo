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
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
