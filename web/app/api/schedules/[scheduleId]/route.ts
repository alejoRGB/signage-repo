import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UpdateScheduleSchema } from "@/lib/validations";

function timeToMinutes(value: string) {
    const [hour, minute] = value.split(":").map((part) => Number(part));
    return hour * 60 + minute;
}

export async function GET(
    _req: Request,
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
    _req: Request,
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
        const parsed = UpdateScheduleSchema.safeParse(json);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
                { status: 400 }
            );
        }

        const { name, items } = parsed.data;

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
            const playlistIds = [
                ...new Set(
                    items
                        .map((i) => i.playlistId)
                        .filter((playlistId): playlistId is string => Boolean(playlistId))
                ),
            ];

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
            const byDay: Record<number, { start: string; end: string; startMinutes: number; endMinutes: number }[]> = {};
            for (const item of items) {
                if (!byDay[item.dayOfWeek]) byDay[item.dayOfWeek] = [];
                byDay[item.dayOfWeek].push({
                    start: item.startTime,
                    end: item.endTime,
                    startMinutes: timeToMinutes(item.startTime),
                    endMinutes: timeToMinutes(item.endTime),
                });
            }

            for (const day in byDay) {
                const dayItems = byDay[day].sort((a, b) => a.startMinutes - b.startMinutes);
                for (let i = 0; i < dayItems.length - 1; i++) {
                    const current = dayItems[i];
                    const next = dayItems[i + 1];
                    if (next.startMinutes < current.endMinutes) {
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
                    create: items.map((item) => ({
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
