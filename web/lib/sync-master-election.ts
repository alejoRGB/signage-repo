import { type SyncSessionDeviceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACTIVE_SYNC_SESSION_STATUSES } from "@/lib/sync-session-service";
import { buildPreparePayload } from "@/lib/sync-command-service";
import { SYNC_DEVICE_COMMAND_TYPE } from "@/types/sync";

export const DEFAULT_MASTER_HEARTBEAT_TIMEOUT_MS = 5000;

type StartElectionDevice = {
    deviceId: string;
    lastSeenAt: Date | null;
};

type SessionElectionDevice = {
    deviceId: string;
    status: SyncSessionDeviceStatus;
    lastSeenAt: Date | null;
    fallbackLastSeenAt: Date | null;
    healthScore: number | null;
};

const MASTER_STATUS_PRIORITY: Record<SyncSessionDeviceStatus, number> = {
    PLAYING: 60,
    WARMING_UP: 50,
    READY: 40,
    PRELOADING: 30,
    ASSIGNED: 20,
    DISCONNECTED: 0,
    ERRORED: 0,
};

function toTimestamp(value: Date | null | undefined) {
    if (!value) {
        return 0;
    }
    return value.getTime();
}

function resolveLastSeenAt(device: SessionElectionDevice): Date | null {
    return device.lastSeenAt ?? device.fallbackLastSeenAt ?? null;
}

function isEligibleStatus(status: SyncSessionDeviceStatus) {
    return status !== "DISCONNECTED" && status !== "ERRORED";
}

function isFreshHeartbeat(lastSeenAt: Date | null, nowMs: number, heartbeatTimeoutMs: number) {
    if (!lastSeenAt) {
        return false;
    }

    return nowMs - lastSeenAt.getTime() <= heartbeatTimeoutMs;
}

function compareCandidates(a: SessionElectionDevice, b: SessionElectionDevice) {
    const statusDiff = MASTER_STATUS_PRIORITY[b.status] - MASTER_STATUS_PRIORITY[a.status];
    if (statusDiff !== 0) {
        return statusDiff;
    }

    const healthA = a.healthScore ?? -1;
    const healthB = b.healthScore ?? -1;
    if (healthA !== healthB) {
        return healthB - healthA;
    }

    const lastSeenDiff = toTimestamp(resolveLastSeenAt(b)) - toTimestamp(resolveLastSeenAt(a));
    if (lastSeenDiff !== 0) {
        return lastSeenDiff;
    }

    return a.deviceId.localeCompare(b.deviceId);
}

function pickMasterCandidate(
    devices: SessionElectionDevice[],
    options: {
        nowMs: number;
        heartbeatTimeoutMs: number;
        allowStaleFallback: boolean;
    }
) {
    const eligible = devices.filter((device) => isEligibleStatus(device.status));
    if (eligible.length === 0) {
        return null;
    }

    const fresh = eligible.filter((device) =>
        isFreshHeartbeat(resolveLastSeenAt(device), options.nowMs, options.heartbeatTimeoutMs)
    );

    if (fresh.length > 0) {
        return [...fresh].sort(compareCandidates)[0] ?? null;
    }

    if (!options.allowStaleFallback) {
        return null;
    }

    return [...eligible].sort(compareCandidates)[0] ?? null;
}

function isMasterHealthy(
    sessionDevices: SessionElectionDevice[],
    masterDeviceId: string | null | undefined,
    nowMs: number,
    heartbeatTimeoutMs: number
) {
    if (!masterDeviceId) {
        return false;
    }

    const master = sessionDevices.find((device) => device.deviceId === masterDeviceId);
    if (!master) {
        return false;
    }

    if (!isEligibleStatus(master.status)) {
        return false;
    }

    return isFreshHeartbeat(resolveLastSeenAt(master), nowMs, heartbeatTimeoutMs);
}

export function selectInitialMasterDeviceId(
    devices: StartElectionDevice[]
): string | null {
    if (devices.length === 0) {
        return null;
    }

    const candidates: SessionElectionDevice[] = devices.map((device) => ({
        deviceId: device.deviceId,
        status: "ASSIGNED",
        lastSeenAt: null,
        fallbackLastSeenAt: device.lastSeenAt,
        healthScore: null,
    }));

    return (
        pickMasterCandidate(candidates, {
            nowMs: Date.now(),
            heartbeatTimeoutMs: DEFAULT_MASTER_HEARTBEAT_TIMEOUT_MS,
            allowStaleFallback: true,
        })?.deviceId ?? null
    );
}

function resolveSessionMediaByDevice(
    session: {
        preset: {
            mode: "COMMON" | "PER_DEVICE";
            presetMedia: {
                id: string;
                filename: string | null;
                width: number | null;
                height: number | null;
                fps: number | null;
            } | null;
            devices: Array<{
                deviceId: string;
                mediaItem: {
                    id: string;
                    filename: string | null;
                    width: number | null;
                    height: number | null;
                    fps: number | null;
                } | null;
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

export async function maybeReelectMasterForSession(
    sessionId: string,
    options?: {
        nowMs?: number;
        heartbeatTimeoutMs?: number;
    }
) {
    const nowMs = options?.nowMs ?? Date.now();
    const heartbeatTimeoutMs = options?.heartbeatTimeoutMs ?? DEFAULT_MASTER_HEARTBEAT_TIMEOUT_MS;

    const session = await prisma.syncSession.findFirst({
        where: {
            id: sessionId,
            status: { in: ACTIVE_SYNC_SESSION_STATUSES },
        },
        select: {
            id: true,
            presetId: true,
            status: true,
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
            devices: {
                select: {
                    deviceId: true,
                    status: true,
                    lastSeenAt: true,
                    healthScore: true,
                    device: {
                        select: {
                            lastSeenAt: true,
                        },
                    },
                },
            },
        },
    });

    if (!session || session.devices.length === 0) {
        return { changed: false as const, reason: "SESSION_NOT_ACTIVE" as const };
    }

    const electionDevices: SessionElectionDevice[] = session.devices.map((device) => ({
        deviceId: device.deviceId,
        status: device.status,
        lastSeenAt: device.lastSeenAt,
        fallbackLastSeenAt: device.device.lastSeenAt,
        healthScore: device.healthScore,
    }));

    if (isMasterHealthy(electionDevices, session.masterDeviceId, nowMs, heartbeatTimeoutMs)) {
        return { changed: false as const, reason: "MASTER_HEALTHY" as const };
    }

    const nextMaster = pickMasterCandidate(electionDevices, {
        nowMs,
        heartbeatTimeoutMs,
        allowStaleFallback: false,
    });

    if (!nextMaster) {
        return { changed: false as const, reason: "NO_ELIGIBLE_MASTER" as const };
    }

    if (nextMaster.deviceId === session.masterDeviceId) {
        return { changed: false as const, reason: "MASTER_UNCHANGED" as const };
    }

    const commandTargets = session.devices.filter(
        (device) => device.deviceId !== nextMaster.deviceId && device.status !== "ERRORED"
    );

    const updateResult = await prisma.$transaction(async (tx) => {
        const updated = await tx.syncSession.updateMany({
            where: {
                id: session.id,
                status: { in: ACTIVE_SYNC_SESSION_STATUSES },
                masterDeviceId: session.masterDeviceId ?? null,
            },
            data: {
                masterDeviceId: nextMaster.deviceId,
            },
        });

        if (updated.count === 0) {
            return { changed: false as const };
        }

        if (commandTargets.length > 0) {
            await tx.syncDeviceCommand.createMany({
                data: commandTargets.flatMap((device) => {
                    const media = resolveSessionMediaByDevice(session, device.deviceId);
                    if (!media) {
                        return [];
                    }

                    const startAtMs =
                        typeof session.startAtMs === "bigint"
                            ? Number(session.startAtMs)
                            : nowMs;

                    return [
                        {
                            deviceId: device.deviceId,
                            sessionId: session.id,
                            type: SYNC_DEVICE_COMMAND_TYPE.SYNC_PREPARE,
                            payload: buildPreparePayload({
                                sessionId: session.id,
                                presetId: session.presetId,
                                mode: session.preset.mode,
                                startAtMs,
                                durationMs: session.durationMs,
                                deviceId: device.deviceId,
                                media: {
                                    mediaId: media.id,
                                    filename: media.filename ?? null,
                                    width: media.width ?? null,
                                    height: media.height ?? null,
                                    fps: media.fps ?? null,
                                },
                                masterDeviceId: nextMaster.deviceId,
                                failoverFromDeviceId: session.masterDeviceId ?? null,
                                electionAtMs: nowMs,
                            }),
                            dedupeKey: `${session.id}:MASTER_FAILOVER:${nextMaster.deviceId}:${device.deviceId}`,
                            status: "PENDING" as const,
                        },
                    ];
                }),
                skipDuplicates: true,
            });
        }

        return { changed: true as const };
    });

    if (!updateResult.changed) {
        return { changed: false as const, reason: "CONCURRENT_UPDATE" as const };
    }

    return {
        changed: true as const,
        previousMasterDeviceId: session.masterDeviceId ?? null,
        nextMasterDeviceId: nextMaster.deviceId,
    };
}
