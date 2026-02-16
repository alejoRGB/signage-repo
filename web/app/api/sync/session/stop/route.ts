import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StopSyncSessionSchema } from "@/lib/validations";
import {
    STOPPABLE_SYNC_SESSION_STATUSES,
    resolveStopStatus,
    syncSessionInclude,
    toJsonSafe,
} from "@/lib/sync-session-service";
import { buildStopPayload } from "@/lib/sync-command-service";
import { SYNC_DEVICE_COMMAND_TYPE } from "@/types/sync";
import { computeSyncSessionMetrics, toPersistedSyncQualitySummary } from "@/lib/sync-metrics";

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

export async function POST(request: Request) {
    const auth = await requireUserSession();
    if (auth.error) {
        return auth.error;
    }

    try {
        const payload = await request.json();
        const result = StopSyncSessionSchema.safeParse(payload);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0]?.message ?? "Invalid payload" },
                { status: 400 }
            );
        }

        const existingSession = await prisma.syncSession.findFirst({
            where: {
                id: result.data.sessionId,
                userId: auth.userId,
            },
            include: {
                devices: {
                    select: {
                        id: true,
                        deviceId: true,
                        status: true,
                        driftHistory: true,
                        resyncCount: true,
                        healthScore: true,
                        maxDriftMs: true,
                    },
                },
            },
        });

        if (!existingSession) {
            return NextResponse.json({ error: "Sync session not found" }, { status: 404 });
        }

        if (!STOPPABLE_SYNC_SESSION_STATUSES.includes(existingSession.status)) {
            return NextResponse.json(
                toJsonSafe({
                    session: existingSession,
                    alreadyStopped: true,
                })
            );
        }

        const stopStatus = resolveStopStatus(result.data.reason);
        const qualitySummary = toPersistedSyncQualitySummary(
            computeSyncSessionMetrics(existingSession.devices)
        );

        const stoppedSession = await prisma.$transaction(async (tx) => {
            await tx.syncSession.update({
                where: {
                    id: existingSession.id,
                },
                data: {
                    status: stopStatus,
                    stoppedAt: new Date(),
                    avgDriftMs: qualitySummary.avgDriftMs,
                    p50DriftMs: qualitySummary.p50DriftMs,
                    p90DriftMs: qualitySummary.p90DriftMs,
                    p95DriftMs: qualitySummary.p95DriftMs,
                    p99DriftMs: qualitySummary.p99DriftMs,
                    maxDriftMs: qualitySummary.maxDriftMs,
                    totalResyncs: qualitySummary.totalResyncs,
                    devicesWithIssues: qualitySummary.devicesWithIssues,
                },
            });

            await tx.syncSessionDevice.updateMany({
                where: {
                    sessionId: existingSession.id,
                    status: { not: "ERRORED" },
                },
                data: {
                    status: "DISCONNECTED",
                },
            });

            await tx.syncDeviceCommand.createMany({
                data: existingSession.devices.map((device) => ({
                    deviceId: device.deviceId,
                    sessionId: existingSession.id,
                    type: SYNC_DEVICE_COMMAND_TYPE.SYNC_STOP,
                    payload: buildStopPayload(existingSession.id, result.data.reason),
                    dedupeKey: `${existingSession.id}:SYNC_STOP:${device.deviceId}:${result.data.reason}`,
                    status: "PENDING",
                })),
                skipDuplicates: true,
            });

            return tx.syncSession.findUnique({
                where: { id: existingSession.id },
                include: syncSessionInclude,
            });
        });

        return NextResponse.json(
            toJsonSafe({
                session: stoppedSession,
                stopReason: result.data.reason,
                qualitySummary,
            })
        );
    } catch (error) {
        console.error("Stop sync session error:", error);
        return NextResponse.json(
            { error: "Failed to stop sync session" },
            { status: 500 }
        );
    }
}
