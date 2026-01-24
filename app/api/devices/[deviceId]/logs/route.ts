import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: Request,
    { params }: { params: { deviceId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { deviceId } = params;

        // Verify device belongs to user
        const device = await prisma.device.findFirst({
            where: {
                id: deviceId,
                userId: session.user.id,
            },
        });

        if (!device) {
            return NextResponse.json({ error: "Device not found" }, { status: 404 });
        }

        // Get query parameters for pagination
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        // Fetch watchdog events for this device
        const events = await prisma.watchdogEvent.findMany({
            where: {
                deviceId: deviceId,
            },
            orderBy: {
                timestamp: "desc",
            },
            take: limit,
            skip: offset,
        });

        // Get total count
        const total = await prisma.watchdogEvent.count({
            where: {
                deviceId: deviceId,
            },
        });

        return NextResponse.json({
            events,
            total,
            limit,
            offset,
        });
    } catch (error) {
        console.error("[WATCHDOG LOGS API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
