import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({
    uniqueTokenPerInterval: 500, // Max 500 users per second
    interval: 60000, // 1 minute
});

export async function POST(request: Request) {
    try {
        // Rate Limiting
        const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
        try {
            await limiter.check(5, ip); // 5 requests per minute per IP
        } catch {
            return NextResponse.json(
                { error: "Too Many Requests" },
                { status: 429 }
            );
        }

        // Generate a 6-digit code
        const code = crypto.randomInt(100000, 999999).toString();

        // Create a new unpaired device
        // We create it with a temporary name until paired
        const device = await prisma.device.create({
            data: {
                name: "Unpaired Device",
                status: "unpaired",
                pairingCode: code,
                pairingCodeExpiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 mins
            },
        });

        return NextResponse.json({
            pairing_code: code,
            device_token: device.token,
            poll_interval: 5000,
            expires_at: device.pairingCodeExpiresAt,
        });
    } catch (error) {
        console.error("Register API error:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
