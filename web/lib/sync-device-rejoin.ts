import { type SyncSessionDeviceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPreparePayload } from "@/lib/sync-command-service";
import { ACTIVE_SYNC_SESSION_STATUSES } from "@/lib/sync-session-service";
import { DEVICE_ONLINE_WINDOW_MS } from "@/lib/device-connectivity";
import { SYNC_DEVICE_COMMAND_TYPE } from "@/types/sync";

const REJOIN_THROTTLE_MS = 10_000;
const REJOIN_DEDUPE_BUCKET_MS = 10_000;

const lastQueuedRejoinBySessionDevice = new Map<string, number>();

type SessionPrepareMedia = {
    id: string;
    filename: string | null;
    width: number | null;
    height: number | null;
    fps: number | null;
};

function toTimestamp(value: Date | null | undefined) {
    if (!value) {
        return 0;
    }
    return value.getTime();
}

function isFreshSessionHeartbeat(
    lastSeenAt: Date | null,
    nowMs: number,
    staleAfterMs: number
) {
    if (!lastSeenAt) {
        return false;
    }
    return nowMs - lastSeenAt.getTime() <= staleAfterMs;
}

function resolveSessionMediaByDevice(
    session: {
        preset: {
            mode: "COMMON" | "PER_DEVICE";
            presetMedia: SessionPrepareMedia | null;
            devices: Array<{
                deviceId: string;
                mediaItem: SessionPrepareMedia | null;
            }>;
        };
    },
    deviceId: string
) {
    if (session.preset.mode === "COMMON") {
        return session.preset.presetMedia;
    }

    const assigned = session.preset.devices.find((item) => item.deviceId === deviceId);
    return assigned?.mediaItem ?? null;
}

function shouldThrottleRejoin(
    sessionId: string,
    deviceId: string,
    nowMs: number,
    throttleMs: number
) {
    const key = `${sessionId}:${deviceId}`;
    const lastQueuedAtMs = lastQueuedRejoinBySessionDevice.get(key);
    if (typeof lastQueuedAtMs === "number" && nowMs - lastQueuedAtMs < throttleMs) {
        return true;
    }

    lastQueuedRejoinBySessionDevice.set(key, nowMs);
    if (lastQueuedRejoinBySessionDevice.size > 2000) {
        for (const [trackedKey, trackedAtMs] of lastQueuedRejoinBySessionDevice.entries()) {
            if (nowMs - trackedAtMs > throttleMs * 6) {
                lastQueuedRejoinBySessionDevice.delete(trackedKey);
            }
        }
    }

    return false;
}

function isRejoinEligibleStatus(status: SyncSessionDeviceStatus) {
    return status !== "ERRORED";
}

export async function maybeQueueSyncRejoinPrepareOnHeartbeat(
    deviceId: string,
    options?: {
        nowMs?: number;
        staleAfterMs?: number;
        throttleMs?: number;
    }
) {
    const nowMs = options?.nowMs ?? Date.now();
    const staleAfterMs = options?.staleAfterMs ?? DEVICE_ONLINE_WINDOW_MS;
    const throttleMs = options?.throttleMs ?? REJOIN_THROTTLE_MS;

    const activeAssignment = await prisma.syncSessionDevice.findFirst({
        where: {
            deviceId,
            session: {
                status: {
                    in: ACTIVE_SYNC_SESSION_STATUSES,
                },
            },
        },
        orderBy: {
            updatedAt: "desc",
        },
        select: {
            id: true,
            sessionId: true,
            status: true,
            lastSeenAt: true,
            session: {
                select: {
                    id: true,
                    presetId: true,
                    durationMs: true,
                    startAtMs: true,
                    masterDeviceId: true,
                    preset: {
                        select: {
                            mode: true,
                            presetMedia: {
                                select: {
                                    id: true,
                                    filename: true,
                                    width: true,
                                    height: true,
                                    fps: true,
                                },
                            },
                            devices: {
                                select: {
                                    deviceId: true,
                                    mediaItem: {
                                        select: {
                                            id: true,
                                            filename: true,
                                            width: true,
                                            height: true,
                                            fps: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!activeAssignment) {
        return { queued: false as const, reason: "NO_ACTIVE_SESSION" as const };
    }

    if (!isRejoinEligibleStatus(activeAssignment.status)) {
        return { queued: false as const, reason: "DEVICE_ERRORED" as const };
    }

    if (
        activeAssignment.status !== "DISCONNECTED" &&
        isFreshSessionHeartbeat(activeAssignment.lastSeenAt, nowMs, staleAfterMs)
    ) {
        return { queued: false as const, reason: "SESSION_HEARTBEAT_FRESH" as const };
    }

    if (shouldThrottleRejoin(activeAssignment.sessionId, deviceId, nowMs, throttleMs)) {
        return { queued: false as const, reason: "THROTTLED" as const };
    }

    const pendingPrepare = await prisma.syncDeviceCommand.findFirst({
        where: {
            deviceId,
            sessionId: activeAssignment.sessionId,
            type: SYNC_DEVICE_COMMAND_TYPE.SYNC_PREPARE,
            status: "PENDING",
        },
        select: {
            id: true,
        },
    });

    if (pendingPrepare) {
        return { queued: false as const, reason: "PENDING_PREPARE_EXISTS" as const };
    }

    const media = resolveSessionMediaByDevice(activeAssignment.session, deviceId);
    if (!media) {
        return { queued: false as const, reason: "MEDIA_MAPPING_MISSING" as const };
    }

    const startAtMs =
        typeof activeAssignment.session.startAtMs === "bigint"
            ? Number(activeAssignment.session.startAtMs)
            : null;
    if (!startAtMs) {
        return { queued: false as const, reason: "SESSION_START_UNSET" as const };
    }

    const dedupeBucket = Math.floor(nowMs / REJOIN_DEDUPE_BUCKET_MS);

    await prisma.syncDeviceCommand.createMany({
        data: [
            {
                deviceId,
                sessionId: activeAssignment.sessionId,
                type: SYNC_DEVICE_COMMAND_TYPE.SYNC_PREPARE,
                payload: buildPreparePayload({
                    sessionId: activeAssignment.session.id,
                    presetId: activeAssignment.session.presetId,
                    mode: activeAssignment.session.preset.mode,
                    startAtMs,
                    durationMs: activeAssignment.session.durationMs,
                    deviceId,
                    masterDeviceId: activeAssignment.session.masterDeviceId ?? null,
                    media: {
                        mediaId: media.id,
                        filename: media.filename ?? null,
                        width: media.width ?? null,
                        height: media.height ?? null,
                        fps: media.fps ?? null,
                    },
                }),
                dedupeKey: `${activeAssignment.sessionId}:DEVICE_REJOIN:${dedupeBucket}:${deviceId}`,
                status: "PENDING" as const,
            },
        ],
        skipDuplicates: true,
    });

    return {
        queued: true as const,
        sessionId: activeAssignment.sessionId,
        deviceId,
    };
}

