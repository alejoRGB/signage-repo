import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId")?.trim() || null;
    const event = searchParams.get("event")?.trim().toUpperCase() || null;
    const limitParam = Number(searchParams.get("limit") ?? "100");
    const limit = Number.isFinite(limitParam)
        ? Math.min(Math.max(Math.trunc(limitParam), 1), 500)
        : 100;

    try {
        // Verify user owns device
        const device = await prisma.device.findFirst({
            where: {
                id: id,
                userId: session.user.id,
            },
        });

        if (!device) {
            return NextResponse.json(
                { error: "Device not found or access denied" },
                { status: 404 }
            );
        }

        // Fetch logs
        const logs = await prisma.deviceLog.findMany({
            where: {
                deviceId: id,
                ...(sessionId ? { sessionId } : {}),
                ...(event ? { event } : {}),
            },
            orderBy: {
                createdAt: "desc",
            },
            take: limit,
        });

        return NextResponse.json({
            events: logs.map(log => ({
                id: log.id,
                level: log.level,
                message: log.message,
                event: log.event,
                sessionId: log.sessionId,
                data: log.data,
                timestamp: log.createdAt.toISOString()
            }))
        });

    } catch (error) {
        console.error("Error fetching device logs:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
