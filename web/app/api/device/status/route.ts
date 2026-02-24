import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitKeyForDeviceToken } from "@/lib/rate-limit-key";
import { getDeviceTokenFromRequest } from "@/lib/device-token-request";

export async function GET(request: Request) {
    try {
        const { token } = getDeviceTokenFromRequest(request);

        if (!token) {
            return NextResponse.json({ error: "Device token required" }, { status: 400 });
        }

        // Rate Limit Check
        const { checkRateLimit } = await import("@/lib/rate-limit");
        const isAllowed = await checkRateLimit(rateLimitKeyForDeviceToken(token), "device_status");
        if (!isAllowed) {
            return NextResponse.json(
                { error: "Too many requests" },
                { status: 429 }
            );
        }

        const device = await prisma.device.findUnique({
            where: { token },
        });

        if (!device) {
            return NextResponse.json({ error: "Device not found" }, { status: 404 });
        }

        // Check if device is paired (has a userId)
        if (device.userId) {
            return NextResponse.json({
                status: "paired",
                device_name: device.name,
            });
        }

        return NextResponse.json({
            status: "unpaired",
            pairing_code: device.pairingCode,
        });

    } catch (error) {
        console.error("Status API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
