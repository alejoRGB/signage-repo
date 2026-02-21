import { prisma } from "@/lib/prisma";
import { SYNC_PRESET_MODE, type SyncPresetMode } from "@/types/sync";

type SyncPresetDeviceInput = {
    deviceId: string;
    mediaItemId?: string | null;
};

type ValidateSyncPresetInput = {
    userId: string;
    mode: SyncPresetMode;
    durationMs: number;
    presetMediaId?: string | null;
    devices: SyncPresetDeviceInput[];
};

type MediaWithDuration = {
    durationMs: number | null;
    duration: number;
};

type ValidateSyncPresetResult = {
    presetMediaId: string | null;
    assignments: Array<{ deviceId: string; mediaItemId: string | null }>;
};

export class SyncPresetValidationError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

export const syncPresetInclude = {
    presetMedia: {
        select: {
            id: true,
            name: true,
            type: true,
            durationMs: true,
        },
    },
    devices: {
        include: {
            device: {
                select: {
                    id: true,
                    name: true,
                    status: true,
                },
            },
            mediaItem: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    durationMs: true,
                },
            },
        },
    },
} as const;

function ensureUniqueDeviceAssignments(devices: SyncPresetDeviceInput[]) {
    const uniqueDeviceCount = new Set(devices.map((device) => device.deviceId)).size;
    if (uniqueDeviceCount !== devices.length) {
        throw new SyncPresetValidationError("Devices must be unique within a preset");
    }
}

async function validateOwnedDevices(userId: string, deviceIds: string[]) {
    const uniqueDeviceIds = [...new Set(deviceIds)];
    const ownedDevices = await prisma.device.findMany({
        where: {
            id: { in: uniqueDeviceIds },
            userId,
        },
        select: { id: true },
    });

    if (ownedDevices.length !== uniqueDeviceIds.length) {
        throw new SyncPresetValidationError("One or more devices are invalid or not owned by user", 403);
    }
}

async function validateVideoMediaByIds(userId: string, mediaIds: string[], durationMs: number) {
    const uniqueMediaIds = [...new Set(mediaIds)];
    const mediaItems = await prisma.mediaItem.findMany({
        where: {
            id: { in: uniqueMediaIds },
            userId,
            type: "video",
        },
        select: {
            id: true,
            durationMs: true,
            duration: true,
        },
    });

    if (mediaItems.length !== uniqueMediaIds.length) {
        throw new SyncPresetValidationError("One or more media items are invalid, not videos, or not owned by user", 403);
    }

    const toDurationMs = (media: MediaWithDuration) => {
        if (typeof media.durationMs === "number" && Number.isFinite(media.durationMs) && media.durationMs > 0) {
            return media.durationMs;
        }

        if (typeof media.duration === "number" && Number.isFinite(media.duration) && media.duration > 0) {
            return Math.max(1, Math.round(media.duration * 1000));
        }

        return null;
    };

    const invalidDuration = mediaItems.find((media) => toDurationMs(media) !== durationMs);

    if (invalidDuration) {
        throw new SyncPresetValidationError(
            `Media item ${invalidDuration.id} durationMs must exactly match preset durationMs`
        );
    }
}

export async function validateSyncPresetInput(
    input: ValidateSyncPresetInput
): Promise<ValidateSyncPresetResult> {
    const { userId, mode, durationMs, presetMediaId, devices } = input;

    if (devices.length < 2) {
        throw new SyncPresetValidationError("At least two devices are required");
    }

    ensureUniqueDeviceAssignments(devices);
    await validateOwnedDevices(
        userId,
        devices.map((device) => device.deviceId)
    );

    if (mode === SYNC_PRESET_MODE.COMMON) {
        if (!presetMediaId) {
            throw new SyncPresetValidationError("presetMediaId is required when mode is COMMON");
        }

        await validateVideoMediaByIds(userId, [presetMediaId], durationMs);
        return {
            presetMediaId,
            assignments: devices.map((device) => ({
                deviceId: device.deviceId,
                mediaItemId: null,
            })),
        };
    }

    const invalidAssignment = devices.find((device) => !device.mediaItemId);
    if (invalidAssignment) {
        throw new SyncPresetValidationError("Each device must define mediaItemId in PER_DEVICE mode");
    }

    const mediaIds = devices.map((device) => device.mediaItemId as string);
    await validateVideoMediaByIds(userId, mediaIds, durationMs);

    return {
        presetMediaId: null,
        assignments: devices.map((device) => ({
            deviceId: device.deviceId,
            mediaItemId: device.mediaItemId as string,
        })),
    };
}
