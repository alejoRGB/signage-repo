import { SyncSessionStatus, type SyncSessionDeviceStatus } from "@prisma/client";
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

export function getPostStopDeviceStatus(status: SyncSessionDeviceStatus): SyncSessionDeviceStatus {
    if (status === "ERRORED") {
        return status;
    }

    return "DISCONNECTED";
}
