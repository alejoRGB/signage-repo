import { NextResponse } from "next/server";
import { CreateScheduleSchema } from "@/lib/validations";
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
        return new NextResponse(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
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

        // Validation
        const result = CreateScheduleSchema.safeParse(json);
        if (!result.success) {
            return new NextResponse(result.error.issues[0].message, { status: 400 });
        }

        const { name } = result.data;

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
