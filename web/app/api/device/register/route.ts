import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitKeyForIp } from "@/lib/rate-limit-key";

const PAIRING_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_PAIRING_CODE_ATTEMPTS = 5;

function generatePairingCode() {
    return crypto.randomInt(100000, 1000000).toString();
}

function isPairingCodeUniqueCollision(error: unknown) {
    if (!error || typeof error !== "object") {
        return false;
    }

    const maybeCode = (error as { code?: unknown }).code;
    if (maybeCode !== "P2002") {
        return false;
    }

    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    if (Array.isArray(target)) {
        return target.includes("pairingCode");
    }

    if (typeof target === "string") {
        return target.includes("pairingCode");
    }

    // For this create path, a P2002 is most likely the pairing code unique index.
    return true;
}

export async function POST(request: Request) {
    try {
        const isAllowed = await checkRateLimit(rateLimitKeyForIp(request), "device_register");

        if (!isAllowed) {
            return NextResponse.json(
                { error: "Too Many Requests" },
                { status: 429 }
            );
        }

        let code = "";
        let device: Awaited<ReturnType<typeof prisma.device.create>> | null = null;

        for (let attempt = 1; attempt <= MAX_PAIRING_CODE_ATTEMPTS; attempt += 1) {
            code = generatePairingCode();

            try {
                device = await prisma.device.create({
                    data: {
                        name: "Unpaired Device",
                        status: "unpaired",
                        pairingCode: code,
                        pairingCodeExpiresAt: new Date(Date.now() + PAIRING_CODE_TTL_MS),
                    },
                });
                break;
            } catch (error) {
                if (isPairingCodeUniqueCollision(error) && attempt < MAX_PAIRING_CODE_ATTEMPTS) {
                    continue;
                }
                if (isPairingCodeUniqueCollision(error)) {
                    console.warn("[DEVICE_REGISTER_POST] Pairing code collision retries exhausted");
                    return NextResponse.json(
                        { error: "Unable to generate pairing code. Please retry." },
                        { status: 503 }
                    );
                }
                throw error;
            }
        }

        if (!device) {
            return NextResponse.json(
                { error: "Unable to generate pairing code. Please retry." },
                { status: 503 }
            );
        }

        return NextResponse.json({
            pairing_code: code,
            device_token: device.token,
            poll_interval: 5000,
            expires_at: device.pairingCodeExpiresAt,
        });
    } catch (error) {
        console.error("Register API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
