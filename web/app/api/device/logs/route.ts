import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SYNC_LOG_EVENT, type SyncLogEvent } from "@/types/sync";
import { rateLimitKeyForDeviceToken } from "@/lib/rate-limit-key";

const ALLOWED_SYNC_LOG_EVENTS = new Set<string>(Object.values(SYNC_LOG_EVENT));
const ALLOWED_LOG_LEVELS = new Set(["debug", "info", "warning", "error", "critical"]);
const MAX_LOGS_PER_BATCH = 50;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_DATA_JSON_BYTES = 4096;
const LOG_CLEANUP_INTERVAL_MS = 15 * 60_000;
const lastCleanupByDevice = new Map<string, number>();

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
    if (ALLOWED_LOG_LEVELS.has(normalized)) {
        return normalized;
    }
    return "info";
}

function normalizeMessage(message: unknown, event?: string) {
    if (typeof message === "string" && message.trim().length > 0) {
        return message
            .replace(/[\r\n\t\0-\x1f\x7f]+/g, " ")
            .trim()
            .slice(0, MAX_MESSAGE_LENGTH);
    }

    if (event) {
        return `[SYNC_EVENT] ${event}`;
    }

    return "device-log";
}

function normalizeClientTimestamp(timestamp: unknown) {
    if (typeof timestamp === "string" || typeof timestamp === "number") {
        const parsed = new Date(timestamp);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return null;
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
    try {
        const serialized = JSON.stringify(value);
        if (!serialized) {
            return undefined;
        }
        if (Buffer.byteLength(serialized, "utf8") > MAX_DATA_JSON_BYTES) {
            return {
                truncated: true,
                reason: "data_too_large",
            } as Prisma.InputJsonValue;
        }
        return JSON.parse(serialized) as Prisma.InputJsonValue;
    } catch {
        return {
            truncated: true,
            reason: "data_not_serializable",
        } as Prisma.InputJsonValue;
    }
}

function attachIngestionMeta(
    data: Prisma.InputJsonValue | undefined,
    clientTimestamp: Date | null
): Prisma.InputJsonValue | undefined {
    if (!clientTimestamp) {
        return data;
    }

    const base =
        data && typeof data === "object" && !Array.isArray(data)
            ? (data as Prisma.JsonObject)
            : {};

    return {
        ...base,
        client_timestamp: clientTimestamp.toISOString(),
    } as Prisma.InputJsonValue;
}

function shouldRunCleanup(deviceId: string, nowMs: number) {
    const lastRun = lastCleanupByDevice.get(deviceId);
    if (typeof lastRun === "number" && nowMs - lastRun < LOG_CLEANUP_INTERVAL_MS) {
        return false;
    }
    lastCleanupByDevice.set(deviceId, nowMs);
    return true;
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
        const isAllowed = await checkRateLimit(rateLimitKeyForDeviceToken(device_token), "device_logs");
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
            include: {
                user: {
                    select: { isActive: true },
                },
            },
        });

        if (!device) {
            return NextResponse.json(
                { error: "Invalid device token" },
                { status: 401 }
            );
        }

        if (device.user && !device.user.isActive) {
            return NextResponse.json(
                { error: "Account suspended" },
                { status: 403 }
            );
        }

        const incomingLogs = logs as IncomingLog[];
        let ignoredUnknownEventCount = 0;

        // Limit logs to prevent spam (max 50 logs per batch)
        const logsToSave = incomingLogs.slice(0, MAX_LOGS_PER_BATCH).map((log) => {
            const rawEvent = typeof log.event === "string" ? log.event.trim() : "";
            const event = normalizeSyncEvent(log.event);
            if (rawEvent && !event) {
                ignoredUnknownEventCount += 1;
            }
            const sessionId = normalizeSessionId(log.session_id ?? log.sessionId);
            const clientTimestamp = normalizeClientTimestamp(log.timestamp);
            const data = attachIngestionMeta(normalizeData(log.data), clientTimestamp);

            return {
                deviceId: device.id,
                level: normalizeLevel(log.level),
                message: normalizeMessage(log.message, event ?? undefined),
                event,
                sessionId,
                data,
                createdAt: new Date(),
            };
        });

        if (logsToSave.length > 0) {
            await prisma.deviceLog.createMany({
                data: logsToSave,
            });
        }

        if (shouldRunCleanup(device.id, Date.now())) {
            // Temporary opportunistic cleanup (7d retention). Prefer a scheduled job in production.
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
        }

        return NextResponse.json({
            success: true,
            count: logsToSave.length,
            ignored_unknown_events: ignoredUnknownEventCount,
        });

    } catch (error) {
        console.error("Log API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
