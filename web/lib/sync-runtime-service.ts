import { prisma } from "@/lib/prisma";
import { SyncSessionDeviceStatus, SyncSessionStatus } from "@prisma/client";

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
    };
}

function nextDriftHistory(
    currentHistory: unknown,
    driftMs: number | null | undefined,
    status: SyncSessionDeviceStatus | null
) {
    if (driftMs === null || driftMs === undefined) {
        return currentHistory ?? null;
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

    return next.slice(-300);
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

    const updateData: {
        lastSeenAt: Date;
        status?: SyncSessionDeviceStatus;
        driftHistory?: unknown;
        resyncCount?: number;
        avgDriftMs?: number;
        maxDriftMs?: number;
        resyncRate?: number;
        clockOffsetMs?: number;
        cpuTemp?: number;
        throttled?: boolean;
        healthScore?: number;
    } = {
        lastSeenAt: new Date(),
    };

    if (normalizedStatus) {
        updateData.status = normalizedStatus;
    }
    updateData.driftHistory = nextDriftHistory(
        sessionDevice.driftHistory,
        runtime.driftMs,
        normalizedStatus
    );

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

    await prisma.syncSessionDevice.update({
        where: { id: sessionDevice.id },
        data: updateData,
    });

    const sessionStatus = sessionDevice.session.status;
    if (
        normalizedStatus === SyncSessionDeviceStatus.PLAYING &&
        [SyncSessionStatus.STARTING, SyncSessionStatus.WARMING_UP, SyncSessionStatus.CREATED].includes(
            sessionStatus
        )
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
        [SyncSessionStatus.STARTING, SyncSessionStatus.CREATED].includes(sessionStatus)
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
            await prisma.syncSession.update({
                where: { id: sessionDevice.sessionId },
                data: {
                    status: SyncSessionStatus.WARMING_UP,
                },
            });
        }
    }
}
