import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";

// Remove old limiter definition
// const limiter = ...

export async function POST(request: Request) {
    try {
        // Rate Limiting
        const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
        const isAllowed = await checkRateLimit(ip, "device_register");

        if (!isAllowed) {
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
