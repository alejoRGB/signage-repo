import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playlists = await prisma.playlist.findMany({
        where: {
            userId: session.user.id,
        },
        include: {
            _count: {
                select: { items: true },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return NextResponse.json(playlists);
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const json = await request.json();
        const { name } = json;

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const playlist = await prisma.playlist.create({
            data: {
                userId: session.user.id,
                name: name,
            },
        });

        return NextResponse.json(playlist);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to create playlist" },
            { status: 500 }
        );
    }
}
