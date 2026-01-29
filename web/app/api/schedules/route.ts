import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/schedules - List all schedules
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const schedules = await prisma.schedule.findMany({
            where: {
                userId: session.user.id,
            },
            include: {
                _count: {
                    select: { devices: true, items: true },
                },
            },
            orderBy: {
                updatedAt: "desc",
            },
        });

        return NextResponse.json(schedules);
    } catch (error) {
        console.error("[SCHEDULES_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST /api/schedules - Create a new schedule
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const json = await req.json();
        const { name } = json;

        if (!name) {
            return new NextResponse("Name is required", { status: 400 });
        }

        const schedule = await prisma.schedule.create({
            data: {
                name,
                userId: session.user.id,
            },
        });

        return NextResponse.json(schedule);
    } catch (error) {
        console.error("[SCHEDULES_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
