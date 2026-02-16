import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SYNC_LOG_EVENT, type SyncLogEvent } from "@/types/sync";

const ALLOWED_SYNC_LOG_EVENTS = new Set<string>(Object.values(SYNC_LOG_EVENT));

type IncomingLog = {
    level?: string;
    message?: string;
    timestamp?: string | number;
    event?: string;
    session_id?: string;
    sessionId?: string;
    data?: unknown;
};

function normalizeLevel(level: unknown) {
    if (typeof level !== "string") {
        return "info";
    }
    const normalized = level.trim().toLowerCase();
    if (!normalized) {
        return "info";
    }
    return normalized.slice(0, 20);
}

function normalizeMessage(message: unknown, event?: string) {
    if (typeof message === "string" && message.trim().length > 0) {
        return message.trim().slice(0, 4000);
    }

    if (event) {
        return `[SYNC_EVENT] ${event}`;
    }

    return "device-log";
}

function normalizeTimestamp(timestamp: unknown) {
    if (typeof timestamp === "string" || typeof timestamp === "number") {
        const parsed = new Date(timestamp);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return new Date();
}

function normalizeSessionId(value: unknown) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 191) : null;
}

function normalizeSyncEvent(value: unknown): SyncLogEvent | null {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toUpperCase();
    if (!normalized) {
        return null;
    }

    if (!ALLOWED_SYNC_LOG_EVENTS.has(normalized)) {
        return null;
    }

    return normalized as SyncLogEvent;
}

function normalizeData(value: unknown): Prisma.InputJsonValue | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }

    return value as Prisma.InputJsonValue;
}

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

        const incomingLogs = logs as IncomingLog[];
        const hasInvalidSyncEvent = incomingLogs.some((log) => {
            if (typeof log?.event !== "string") {
                return false;
            }
            return !ALLOWED_SYNC_LOG_EVENTS.has(log.event.trim().toUpperCase());
        });

        if (hasInvalidSyncEvent) {
            return NextResponse.json(
                { error: "Invalid sync log event in logs payload" },
                { status: 400 }
            );
        }

        // Limit logs to prevent spam (max 50 logs per batch)
        const logsToSave = incomingLogs.slice(0, 50).map((log) => {
            const event = normalizeSyncEvent(log.event);
            const sessionId = normalizeSessionId(log.session_id ?? log.sessionId);
            const data = normalizeData(log.data);

            return {
                deviceId: device.id,
                level: normalizeLevel(log.level),
                message: normalizeMessage(log.message, event ?? undefined),
                event,
                sessionId,
                data,
                createdAt: normalizeTimestamp(log.timestamp),
            };
        });

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
