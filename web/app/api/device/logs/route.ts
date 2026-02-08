import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const { device_token, logs } = json;

        if (!device_token || typeof device_token !== "string") {
            return NextResponse.json(
                { error: "device_token is required" },
                { status: 400 }
            );
        }

        // Rate Limit Check
        const { checkRateLimit } = await import("@/lib/rate-limit");
        const isAllowed = await checkRateLimit(device_token);
        if (!isAllowed) {
            return NextResponse.json(
                { error: "Too many requests" },
                { status: 429 }
            );
        }

        if (!logs || !Array.isArray(logs)) {
            return NextResponse.json(
                { error: "logs array is required" },
                { status: 400 }
            );
        }

        // Find device by token
        const device = await prisma.device.findUnique({
            where: { token: device_token },
        });

        if (!device) {
            return NextResponse.json(
                { error: "Invalid device token" },
                { status: 401 }
            );
        }

        // Limit logs to prevent spam (max 50 logs per batch)
        const logsToSave = logs.slice(0, 50).map((log: any) => ({
            deviceId: device.id,
            level: log.level || "info",
            message: log.message || "",
            createdAt: log.timestamp ? new Date(log.timestamp) : new Date(),
        }));

        if (logsToSave.length > 0) {
            await prisma.deviceLog.createMany({
                data: logsToSave,
            });
        }

        // Cleanup old logs (keep last 1000 per device, simple cleanup)
        // Note: In production, this might be better as a cron job or scheduled task
        // but for now, we'll do a quick check occasionally or just let it grow a bit.
        // To be safe and simple: Delete logs older than 7 days for this device
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Asynchronous cleanup (fire and forget)
        prisma.deviceLog.deleteMany({
            where: {
                deviceId: device.id,
                createdAt: {
                    lt: sevenDaysAgo
                }
            }
        }).catch(err => console.error("Log cleanup error:", err));

        return NextResponse.json({ success: true, count: logsToSave.length });

    } catch (error) {
        console.error("Log API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
