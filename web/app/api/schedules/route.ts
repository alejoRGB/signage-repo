import { NextResponse } from "next/server";
import { CreateScheduleSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/schedules - List all schedules
// GET /api/schedules - List all schedules
export async function GET() {
    try {
        console.log("[SCHEDULES_GET] Starting request");
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            console.log("[SCHEDULES_GET] Unauthorized");
            return new NextResponse("Unauthorized", { status: 401 });
        }

        console.log("[SCHEDULES_GET] Fetching schedules for user:", session.user.id);
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

        console.log("[SCHEDULES_GET] Success, count:", schedules.length);
        return NextResponse.json(schedules);
    } catch (error) {
        console.error("[SCHEDULES_GET] Critical Error:", error);
        return new NextResponse(JSON.stringify({
            error: String(error),
            stack: error instanceof Error ? error.stack : undefined
        }), {
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
