import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.substring(7);

        // Find device by token
        const device = await prisma.device.findUnique({
            where: { token },
        });

        if (!device) {
            return NextResponse.json({ error: "Device not found" }, { status: 404 });
        }

        const body = await request.json();
        const { event_type, details, timestamp, restart_count } = body;

        // Store watchdog event in database
        await prisma.watchdogEvent.create({
            data: {
                deviceId: device.id,
                eventType: event_type,
                details: details || "",
                restartCount: restart_count || 0,
                timestamp: new Date(timestamp),
            },
        });

        console.log(`[WATCHDOG] Device ${device.name} (${device.id}):`, {
            event_type,
            details,
            timestamp,
            restart_count,
        });

        return NextResponse.json({
            success: true,
            message: "Watchdog event logged"
        });
    } catch (error) {
        console.error("[WATCHDOG API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
