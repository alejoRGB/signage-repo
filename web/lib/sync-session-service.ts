import { SyncSessionStatus } from "@prisma/client";
import { SYNC_STOP_REASON, type SyncStopReason } from "@/types/sync";

export const ACTIVE_SYNC_SESSION_STATUSES: SyncSessionStatus[] = [
    SyncSessionStatus.CREATED,
    SyncSessionStatus.STARTING,
    SyncSessionStatus.WARMING_UP,
    SyncSessionStatus.RUNNING,
];

export const STOPPABLE_SYNC_SESSION_STATUSES: SyncSessionStatus[] = [
    SyncSessionStatus.CREATED,
    SyncSessionStatus.STARTING,
    SyncSessionStatus.WARMING_UP,
    SyncSessionStatus.RUNNING,
];

export const MIN_SYNC_START_TIMEOUT_MS = 15_000;
export const DEFAULT_SYNC_START_TIMEOUT_MS = 45_000;
export const MAX_SYNC_START_TIMEOUT_MS = 120_000;

export const syncSessionInclude = {
    preset: {
        select: {
            id: true,
            name: true,
            mode: true,
            durationMs: true,
            presetMediaId: true,
        },
    },
    devices: {
        include: {
            device: {
                select: {
                    id: true,
                    name: true,
                    status: true,
                    lastSeenAt: true,
                },
            },
        },
    },
    masterDevice: {
        select: {
            id: true,
            name: true,
            status: true,
            lastSeenAt: true,
        },
    },
} as const;

export function computePreparationBufferMs(
    input: {
        requestedBufferMs?: number;
        deviceCount: number;
        hasColdDevice: boolean;
    }
) {
    if (typeof input.requestedBufferMs === "number") {
        return input.requestedBufferMs;
    }

    let bufferMs = 8000;

    if (input.hasColdDevice) {
        bufferMs += 1000;
    }

    if (input.deviceCount >= 10) {
        bufferMs += 1000;
    }

    return Math.min(bufferMs, 12000);
}

export function computeStartTimeoutMs(
    input: {
        requestedTimeoutMs?: number;
        deviceCount: number;
        hasColdDevice: boolean;
    }
) {
    if (typeof input.requestedTimeoutMs === "number") {
        return input.requestedTimeoutMs;
    }

    // Allow enough time for media fetch + preload + READY reporting before the
    // backend start-timeout watchdog considers the session stuck.
    let timeoutMs = DEFAULT_SYNC_START_TIMEOUT_MS;

    if (input.hasColdDevice) {
        timeoutMs += 10_000;
    }

    if (input.deviceCount >= 6) {
        timeoutMs += 5_000;
    }

    if (input.deviceCount >= 12) {
        timeoutMs += 10_000;
    }

    return Math.min(timeoutMs, MAX_SYNC_START_TIMEOUT_MS);
}

export function resolveStopStatus(reason: SyncStopReason): SyncSessionStatus {
    if (reason === SYNC_STOP_REASON.USER_STOP) {
        return SyncSessionStatus.STOPPED;
    }

    return SyncSessionStatus.ABORTED;
}

export function toJsonSafe<T>(payload: T): T {
    return JSON.parse(
        JSON.stringify(payload, (_key, value) => (typeof value === "bigint" ? Number(value) : value))
    ) as T;
}

