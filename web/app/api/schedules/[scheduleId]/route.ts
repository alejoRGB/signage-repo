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

        const existingSchedule = await prisma.schedule.findUnique({
            where: { id: scheduleId },
            select: { userId: true },
        });

        if (!existingSchedule) {
            return new NextResponse("Schedule not found", { status: 404 });
        }

        if (existingSchedule.userId !== session.user.id) {
            return new NextResponse("Unauthorized access to schedule", { status: 403 });
        }

        // Verify ownership of all playlists and check for overlaps if items are provided
        if (items && Array.isArray(items)) {
            const playlistIds = [...new Set(items.map((i: any) => i.playlistId).filter(Boolean))];

            if (playlistIds.length > 0) {
                const playlists = await prisma.playlist.findMany({
                    where: {
                        id: { in: playlistIds },
                    },
                    select: {
                        id: true,
                        userId: true,
                    },
                });

                const foundIds = new Set(playlists.map((p) => p.id));
                const missing = playlistIds.filter((id: string) => !foundIds.has(id));
                if (missing.length > 0) {
                    return NextResponse.json({ error: "One or more playlists were not found" }, { status: 404 });
                }

                const unauthorized = playlists.some((p) => p.userId !== session.user.id);
                if (unauthorized) {
                    return NextResponse.json({ error: "One or more playlists are unauthorized" }, { status: 403 });
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
