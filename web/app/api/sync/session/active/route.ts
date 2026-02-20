import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_SYNC_SESSION_STATUSES, syncSessionInclude, toJsonSafe } from "@/lib/sync-session-service";
import { computeSyncSessionMetrics } from "@/lib/sync-metrics";
import { SYNC_LOG_EVENT } from "@/types/sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireUserSession() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    if (session.user.role !== "USER") {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }

    return { userId: session.user.id };
}

export async function GET() {
    const auth = await requireUserSession();
    if (auth.error) {
        return auth.error;
    }

    const session = await prisma.syncSession.findFirst({
        where: {
            userId: auth.userId,
            status: { in: ACTIVE_SYNC_SESSION_STATUSES },
        },
        include: syncSessionInclude,
        orderBy: {
            createdAt: "desc",
        },
    });

    const sessionDevices = Array.isArray(session?.devices) ? session.devices : [];
    const metrics = session
        ? computeSyncSessionMetrics(
              sessionDevices.map((device) => ({
                  status: device.status,
                  resyncCount: device.resyncCount,
                  healthScore: device.healthScore,
                  maxDriftMs: device.maxDriftMs,
                  driftHistory: device.driftHistory,
              }))
          )
        : null;
    let correctionTelemetryByDeviceId: Record<
        string,
        {
            isCorrectingNow: boolean;
            lastEvent: string | null;
            lastEventAt: string | null;
            lastDriftMs: number | null;
            lastSpeed: number | null;
            lastSeekToMs: number | null;
        }
    > = {};

    if (session && sessionDevices.length > 0) {
        const deviceIds = sessionDevices
            .map((device) => device.deviceId)
            .filter((deviceId): deviceId is string => typeof deviceId === "string" && deviceId.length > 0);
        if (deviceIds.length === 0) {
            return NextResponse.json(
                toJsonSafe({
                    session,
                    metrics,
                    correctionTelemetryByDeviceId,
                }),
                {
                    headers: {
                        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                        Pragma: "no-cache",
                        Expires: "0",
                        "Surrogate-Control": "no-store",
                    },
                }
            );
        }
        const correctionEvents = [SYNC_LOG_EVENT.SOFT_CORRECTION, SYNC_LOG_EVENT.HARD_RESYNC] as const;
        const ACTIVE_CORRECTION_WINDOW_MS = 12_000;
        const CORRECTION_LOOKBACK_MS = 120_000;
        const recentLogs = await prisma.deviceLog.findMany({
            where: {
                sessionId: session.id,
                deviceId: { in: deviceIds },
                event: { in: [...correctionEvents] },
                createdAt: {
                    gte: new Date(Date.now() - CORRECTION_LOOKBACK_MS),
                },
            },
            select: {
                deviceId: true,
                event: true,
                createdAt: true,
                data: true,
            },
            orderBy: {
                createdAt: "desc",
            },
            take: Math.max(deviceIds.length * 15, 30),
        });

        const latestByDevice = new Map<string, (typeof recentLogs)[number]>();
        for (const log of recentLogs) {
            if (!latestByDevice.has(log.deviceId)) {
                latestByDevice.set(log.deviceId, log);
            }
        }

        correctionTelemetryByDeviceId = deviceIds.reduce<typeof correctionTelemetryByDeviceId>((acc, deviceId) => {
            const latest = latestByDevice.get(deviceId);
            if (!latest) {
                acc[deviceId] = {
                    isCorrectingNow: false,
                    lastEvent: null,
                    lastEventAt: null,
                    lastDriftMs: null,
                    lastSpeed: null,
                    lastSeekToMs: null,
                };
                return acc;
            }

            const data = latest.data && typeof latest.data === "object" ? (latest.data as Record<string, unknown>) : null;
            const driftMs = typeof data?.drift_ms === "number" ? data.drift_ms : null;
            const speed = typeof data?.speed === "number" ? data.speed : null;
            const seekToMs = typeof data?.seek_to_ms === "number" ? data.seek_to_ms : null;
            const ageMs = Date.now() - latest.createdAt.getTime();

            acc[deviceId] = {
                isCorrectingNow: ageMs <= ACTIVE_CORRECTION_WINDOW_MS,
                lastEvent: latest.event ?? null,
                lastEventAt: latest.createdAt.toISOString(),
                lastDriftMs: driftMs,
                lastSpeed: speed,
                lastSeekToMs: seekToMs,
            };
            return acc;
        }, {});
    }

    return NextResponse.json(
        toJsonSafe({
            session,
            metrics,
            correctionTelemetryByDeviceId,
        }),
        {
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                Pragma: "no-cache",
                Expires: "0",
                "Surrogate-Control": "no-store",
            },
        }
    );
}
