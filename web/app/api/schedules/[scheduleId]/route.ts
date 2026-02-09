import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ scheduleId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { scheduleId } = await params;

    try {
        const schedule = await prisma.schedule.findUnique({
            where: {
                id: scheduleId,
                userId: session.user.id,
            },
            include: {
                items: {
                    include: {
                        playlist: true
                    }
                },
            },
        });

        if (!schedule) {
            return new NextResponse("Schedule not found", { status: 404 });
        }

        return NextResponse.json(schedule);
    } catch (error) {
        console.error("[SCHEDULE_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ scheduleId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { scheduleId } = await params;

    try {
        const schedule = await prisma.schedule.delete({
            where: {
                id: scheduleId,
                userId: session.user.id,
            },
        });

        return NextResponse.json(schedule);
    } catch (error) {
        console.error("[SCHEDULE_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ scheduleId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { scheduleId } = await params;

    try {
        const json = await req.json();
        const { name, items } = json;

        // Verify ownership of all playlists and check for overlaps if items are provided
        if (items && Array.isArray(items)) {
            // 1. Verify Ownership
            // We can check one by one or batch. Batch is better but let's stick to the previous loop style or improve it.
            // Using the Set approach for efficiency.
            const playlistIds = [...new Set(items.map((i: any) => i.playlistId).filter(Boolean))];

            if (playlistIds.length > 0) {
                const count = await prisma.playlist.count({
                    where: {
                        id: { in: playlistIds },
                        userId: session.user.id
                    }
                });
                if (count !== playlistIds.length) {
                    return NextResponse.json({ error: "One or more playlists are invalid or unauthorized" }, { status: 400 });
                }
            }

            // 2. Verify Overlaps
            const byDay: Record<number, { start: string; end: string }[]> = {};
            for (const item of items) {
                if (!byDay[item.dayOfWeek]) byDay[item.dayOfWeek] = [];
                byDay[item.dayOfWeek].push({ start: item.startTime, end: item.endTime });
            }

            for (const day in byDay) {
                const dayItems = byDay[day].sort((a, b) => a.start.localeCompare(b.start));
                for (let i = 0; i < dayItems.length - 1; i++) {
                    const current = dayItems[i];
                    const next = dayItems[i + 1];
                    if (next.start < current.end) {
                        return NextResponse.json({
                            error: `Schedule overlap detected on day ${day} between ${current.start}-${current.end} and ${next.start}-${next.end}`
                        }, { status: 400 });
                    }
                }
            }
        }

        // Transaction to update
        const schedule = await prisma.schedule.update({
            where: {
                id: scheduleId,
                userId: session.user.id,
            },
            data: {
                name: name,
                items: items ? {
                    deleteMany: {},
                    create: items.map((item: any) => ({
                        dayOfWeek: item.dayOfWeek,
                        startTime: item.startTime,
                        endTime: item.endTime,
                        playlistId: item.playlistId
                    }))
                } : undefined
            },
        });

        return NextResponse.json(schedule);
    } catch (error) {
        console.error("[SCHEDULE_PATCH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
