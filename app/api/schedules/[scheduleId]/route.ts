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

        // Transaction to update
        const schedule = await prisma.schedule.update({
            where: {
                id: scheduleId,
                userId: session.user.id,
            },
            data: {
                name: name,
                // If items are provided, replace them
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
