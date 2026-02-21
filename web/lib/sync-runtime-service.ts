import { prisma } from "@/lib/prisma";
import { Prisma, SyncSessionDeviceStatus, SyncSessionStatus } from "@prisma/client";
import { buildPreparePayload } from "@/lib/sync-command-service";
import { SYNC_DEVICE_COMMAND_TYPE } from "@/types/sync";

type SyncRuntimeInput = {
    sessionId?: string | null;
    status?: string | null;
    driftMs?: number | null;
    resyncCount?: number | null;
    clockOffsetMs?: number | null;
    cpuTemp?: number | null;
    throttled?: boolean | null;
    healthScore?: number | null;
    avgDriftMs?: number | null;
    maxDriftMs?: number | null;
    resyncRate?: number | null;
    lanMode?: string | null;
    lanBeaconAgeMs?: number | null;
};

const syncStatusMap: Record<string, SyncSessionDeviceStatus> = {
    ASSIGNED: SyncSessionDeviceStatus.ASSIGNED,
    PRELOADING: SyncSessionDeviceStatus.PRELOADING,
    READY: SyncSessionDeviceStatus.READY,
    WARMING_UP: SyncSessionDeviceStatus.WARMING_UP,
    PLAYING: SyncSessionDeviceStatus.PLAYING,
    ERRORED: SyncSessionDeviceStatus.ERRORED,
    DISCONNECTED: SyncSessionDeviceStatus.DISCONNECTED,
};

const SESSION_STATUSES_BEFORE_RUNNING: SyncSessionStatus[] = [
    SyncSessionStatus.STARTING,
    SyncSessionStatus.WARMING_UP,
    SyncSessionStatus.CREATED,
];

const SESSION_STATUSES_BEFORE_WARMUP: SyncSessionStatus[] = [
    SyncSessionStatus.STARTING,
    SyncSessionStatus.CREATED,
];

const READY_BARRIER_MIN_LEAD_MS = 1500;
const READY_BARRIER_MAX_LEAD_MS = 12000;

type SessionPrepareMedia = {
    id: string;
    filename: string | null;
    width: number | null;
    height: number | null;
    fps: number | null;
};

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

function computeReadyBarrierStartAtMs(preparationBufferMs: number) {
    const leadMs = Math.max(
        READY_BARRIER_MIN_LEAD_MS,
        Math.min(READY_BARRIER_MAX_LEAD_MS, preparationBufferMs)
    );
    return Date.now() + leadMs;
}

function normalizeSyncStatus(value?: string | null): SyncSessionDeviceStatus | null {
    if (!value) {
        return null;
    }

    const normalized = value.trim().toUpperCase();
    return syncStatusMap[normalized] ?? null;
}

function toOptionalNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalBoolean(value: unknown): boolean | null {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        const lowered = value.toLowerCase();
        if (lowered === "true" || lowered === "1") return true;
        if (lowered === "false" || lowered === "0") return false;
    }

    return null;
}

function toOptionalLanMode(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return null;
    }

    return normalized.slice(0, 32);
}

export function extractSyncRuntimeFromJson(payload: unknown): SyncRuntimeInput | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    const root = payload as Record<string, unknown>;
    const runtime = root.sync_runtime ?? root.syncRuntime ?? null;
    if (!runtime || typeof runtime !== "object") {
        return null;
    }

    const runtimeRecord = runtime as Record<string, unknown>;

    return {
        sessionId: (runtimeRecord.session_id as string | undefined) ?? (runtimeRecord.sessionId as string | undefined) ?? null,
        status: (runtimeRecord.status as string | undefined) ?? null,
        driftMs: toOptionalNumber(runtimeRecord.drift_ms ?? runtimeRecord.driftMs),
        resyncCount: toOptionalNumber(runtimeRecord.resync_count ?? runtimeRecord.resyncCount),
        clockOffsetMs: toOptionalNumber(runtimeRecord.clock_offset_ms ?? runtimeRecord.clockOffsetMs),
        cpuTemp: toOptionalNumber(runtimeRecord.cpu_temp ?? runtimeRecord.cpuTemp),
        throttled: toOptionalBoolean(runtimeRecord.throttled),
        healthScore: toOptionalNumber(runtimeRecord.health_score ?? runtimeRecord.healthScore),
        avgDriftMs: toOptionalNumber(runtimeRecord.avg_drift_ms ?? runtimeRecord.avgDriftMs),
        maxDriftMs: toOptionalNumber(runtimeRecord.max_drift_ms ?? runtimeRecord.maxDriftMs),
        resyncRate: toOptionalNumber(runtimeRecord.resync_rate ?? runtimeRecord.resyncRate),
        lanMode: toOptionalLanMode(runtimeRecord.lan_mode ?? runtimeRecord.lanMode),
        lanBeaconAgeMs: toOptionalNumber(runtimeRecord.lan_beacon_age_ms ?? runtimeRecord.lanBeaconAgeMs),
    };
}

export function extractSyncRuntimeFromFormData(formData: FormData): SyncRuntimeInput | null {
    const sessionId = formData.get("sync_session_id");
    const status = formData.get("sync_status");

    if (typeof sessionId !== "string" || sessionId.length === 0) {
        return null;
    }

    return {
        sessionId,
        status: typeof status === "string" ? status : null,
        driftMs: toOptionalNumber(formData.get("sync_drift_ms")),
        resyncCount: toOptionalNumber(formData.get("sync_resync_count")),
        clockOffsetMs: toOptionalNumber(formData.get("sync_clock_offset_ms")),
        cpuTemp: toOptionalNumber(formData.get("sync_cpu_temp")),
        throttled: toOptionalBoolean(formData.get("sync_throttled")),
        healthScore: toOptionalNumber(formData.get("sync_health_score")),
        avgDriftMs: toOptionalNumber(formData.get("sync_avg_drift_ms")),
        maxDriftMs: toOptionalNumber(formData.get("sync_max_drift_ms")),
        resyncRate: toOptionalNumber(formData.get("sync_resync_rate")),
        lanMode: toOptionalLanMode(formData.get("sync_lan_mode")),
        lanBeaconAgeMs: toOptionalNumber(formData.get("sync_lan_beacon_age_ms")),
    };
}

function nextDriftHistory(
    currentHistory: unknown,
    driftMs: number | null | undefined,
    status: SyncSessionDeviceStatus | null
): Prisma.InputJsonValue | undefined {
    if (driftMs === null || driftMs === undefined) {
        return undefined;
    }

    const previous = Array.isArray(currentHistory) ? currentHistory : [];
    const next = [
        ...previous,
        {
            at: Date.now(),
            driftMs,
            status,
        },
    ];

    return next.slice(-300) as Prisma.InputJsonValue;
}

export async function persistDeviceSyncRuntime(deviceId: string, runtime: SyncRuntimeInput | null) {
    if (!runtime?.sessionId) {
        return;
    }

    const normalizedStatus = normalizeSyncStatus(runtime.status);

    const sessionDevice = await prisma.syncSessionDevice.findFirst({
        where: {
            sessionId: runtime.sessionId,
            deviceId,
        },
        include: {
            session: {
                select: {
                    id: true,
                    status: true,
                },
            },
        },
    });

    if (!sessionDevice) {
        return;
    }

    const updateData: Prisma.SyncSessionDeviceUpdateInput = {
        lastSeenAt: new Date(),
    };

    if (normalizedStatus) {
        updateData.status = normalizedStatus;
    }
    const driftHistory = nextDriftHistory(
        sessionDevice.driftHistory,
        runtime.driftMs,
        normalizedStatus
    );
    if (driftHistory !== undefined) {
        updateData.driftHistory = driftHistory;
    }

    if (runtime.resyncCount !== null && runtime.resyncCount !== undefined) {
        updateData.resyncCount = Math.max(0, Math.round(runtime.resyncCount));
    }
    if (runtime.avgDriftMs !== null && runtime.avgDriftMs !== undefined) updateData.avgDriftMs = runtime.avgDriftMs;
    if (runtime.maxDriftMs !== null && runtime.maxDriftMs !== undefined) updateData.maxDriftMs = runtime.maxDriftMs;
    if (runtime.resyncRate !== null && runtime.resyncRate !== undefined) updateData.resyncRate = runtime.resyncRate;
    if (runtime.clockOffsetMs !== null && runtime.clockOffsetMs !== undefined) updateData.clockOffsetMs = runtime.clockOffsetMs;
    if (runtime.cpuTemp !== null && runtime.cpuTemp !== undefined) updateData.cpuTemp = runtime.cpuTemp;
    if (runtime.throttled !== null && runtime.throttled !== undefined) updateData.throttled = runtime.throttled;
    if (runtime.healthScore !== null && runtime.healthScore !== undefined) updateData.healthScore = runtime.healthScore;
    if (runtime.lanMode !== null && runtime.lanMode !== undefined) updateData.lanMode = runtime.lanMode;
    if (runtime.lanBeaconAgeMs !== null && runtime.lanBeaconAgeMs !== undefined) {
        updateData.lanBeaconAgeMs = Math.max(0, Math.round(runtime.lanBeaconAgeMs));
    }

    await prisma.syncSessionDevice.update({
        where: { id: sessionDevice.id },
        data: updateData,
    });

    const sessionStatus = sessionDevice.session.status;
    if (
        normalizedStatus === SyncSessionDeviceStatus.PLAYING &&
        SESSION_STATUSES_BEFORE_RUNNING.includes(sessionStatus)
    ) {
        await prisma.syncSession.update({
            where: { id: sessionDevice.sessionId },
            data: {
                status: SyncSessionStatus.RUNNING,
                startedAtMs: BigInt(Date.now()),
            },
        });
        return;
    }

    if (
        normalizedStatus === SyncSessionDeviceStatus.READY &&
        SESSION_STATUSES_BEFORE_WARMUP.includes(sessionStatus)
    ) {
        const nonReadyCount = await prisma.syncSessionDevice.count({
            where: {
                sessionId: sessionDevice.sessionId,
                status: {
                    notIn: [SyncSessionDeviceStatus.READY, SyncSessionDeviceStatus.WARMING_UP, SyncSessionDeviceStatus.PLAYING],
                },
            },
        });

        if (nonReadyCount === 0) {
            await prisma.$transaction(async (tx) => {
                const sessionForBarrier = await tx.syncSession.findFirst({
                    where: {
                        id: sessionDevice.sessionId,
                        status: { in: SESSION_STATUSES_BEFORE_WARMUP },
                    },
                    select: {
                        id: true,
                        presetId: true,
                        durationMs: true,
                        preparationBufferMs: true,
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
                            },
                        },
                    },
                });

                if (!sessionForBarrier) {
                    return;
                }

                const coordinatedStartAtMs = computeReadyBarrierStartAtMs(
                    sessionForBarrier.preparationBufferMs
                );

                const sessionUpdated = await tx.syncSession.updateMany({
                    where: {
                        id: sessionForBarrier.id,
                        status: { in: SESSION_STATUSES_BEFORE_WARMUP },
                    },
                    data: {
                        status: SyncSessionStatus.WARMING_UP,
                        startAtMs: BigInt(coordinatedStartAtMs),
                    },
                });

                if (sessionUpdated.count === 0) {
                    return;
                }

                const prepareCommands = sessionForBarrier.devices
                    .filter((device) => device.status !== SyncSessionDeviceStatus.ERRORED)
                    .map((device) => {
                        const media = resolveSessionMediaByDevice(sessionForBarrier, device.deviceId);
                        if (!media) {
                            throw new Error(
                                `Sync session ${sessionForBarrier.id} is missing media mapping for device ${device.deviceId}`
                            );
                        }

                        return {
                            deviceId: device.deviceId,
                            sessionId: sessionForBarrier.id,
                            type: SYNC_DEVICE_COMMAND_TYPE.SYNC_PREPARE,
                            payload: buildPreparePayload({
                                sessionId: sessionForBarrier.id,
                                presetId: sessionForBarrier.presetId,
                                mode: sessionForBarrier.preset.mode,
                                startAtMs: coordinatedStartAtMs,
                                durationMs: sessionForBarrier.durationMs,
                                deviceId: device.deviceId,
                                masterDeviceId: sessionForBarrier.masterDeviceId,
                                media: {
                                    mediaId: media.id,
                                    filename: media.filename ?? null,
                                    width: media.width ?? null,
                                    height: media.height ?? null,
                                    fps: media.fps ?? null,
                                },
                            }),
                            dedupeKey: `${sessionForBarrier.id}:READY_BARRIER:${coordinatedStartAtMs}:${device.deviceId}`,
                            status: "PENDING" as const,
                        };
                    });

                if (prepareCommands.length > 0) {
                    await tx.syncDeviceCommand.createMany({
                        data: prepareCommands,
                        skipDuplicates: true,
                    });
                }
            });
        }
    }
}
