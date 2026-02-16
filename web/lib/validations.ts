import { z } from "zod";
import xss from "xss";
import {
    SYNC_DEVICE_COMMAND_STATUS,
    SYNC_DEVICE_COMMAND_TYPE,
    SYNC_DRIFT_QUALITY,
    SYNC_PRESET_MODE,
    SYNC_SESSION_DEVICE_STATUS,
    SYNC_STOP_REASON,
} from "@/types/sync";

// Helper to sanitize strings
const sanitize = (value: string) => xss(value);

// Auth Schemas
export const RegisterSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").transform(sanitize),
    username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens").transform(sanitize),
    email: z.string().email("Invalid email address").transform(sanitize),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const LoginSchema = z.object({
    username: z.string().min(1, "Username is required").transform(sanitize),
    password: z.string().min(1, "Password is required"),
});

// Playlist Schemas
export const PlaylistItemSchema = z.object({
    mediaItemId: z.string().min(1, "Media Item ID is required").transform(sanitize),
    order: z.number().int().min(0, "Order must be a non-negative integer"),
    duration: z.number().int().positive("Duration must be positive").optional(), // Duration might be overrideable later
});

export const CreatePlaylistSchema = z.object({
    name: z.string().min(1, "Playlist name is required").max(100, "Name is too long").transform(sanitize),
    type: z.enum(["media", "web"]).optional().default("media"),
    orientation: z.enum(["landscape", "portrait", "portrait-270"]).optional().default("landscape"),
    items: z.array(PlaylistItemSchema).optional(),
});

export const UpdatePlaylistSchema = CreatePlaylistSchema.partial();

// Schedule Schemas
export const CreateScheduleSchema = z.object({
    name: z.string().min(1, "Schedule name is required").max(100).transform(sanitize),
    items: z.array(z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
        endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
        playlistId: z.string().min(1).transform(sanitize),
    })).optional(),
});

// Device Schemas
export const CreateDeviceSchema = z.object({
    name: z.string().min(1, "Device name is required").max(50).transform(sanitize),
});

export const UpdateDeviceSchema = z.object({
    name: z.string().min(1).max(50).transform(sanitize).optional(),
    status: z.enum(["online", "offline", "unpaired"]).optional(),
    activePlaylistId: z.string().optional().nullable().transform((val) => val ? sanitize(val) : val),
    defaultPlaylistId: z.string().optional().nullable().transform((val) => val ? sanitize(val) : val),
    scheduleId: z.string().optional().nullable().transform((val) => val ? sanitize(val) : val),
});

// Admin User Schemas
export const CreateUserSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const ResetPasswordSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const UpdateUserSchema = z.object({
    isActive: z.boolean().optional(),
    name: z.string().optional(),
    role: z.enum(["USER", "ADMIN"]).optional(),
});

export const CreateMediaItemSchema = z.object({
    name: z.string().min(1, "Name is required").transform(sanitize),
    url: z.string().url("Invalid URL").transform(sanitize),
    type: z.enum(["image", "video", "web"]),
    filename: z.string().min(1, "Filename is required").transform(sanitize).optional().nullable(),
    width: z.union([z.number(), z.string().transform((val) => parseInt(val))]).nullable().optional(),
    height: z.union([z.number(), z.string().transform((val) => parseInt(val))]).nullable().optional(),
    fps: z.union([z.number(), z.string().transform((val) => parseFloat(val))]).nullable().optional(),
    size: z.union([z.number(), z.string().transform((val) => parseInt(val))]).nullable().optional(),
    duration: z.union([z.number(), z.string().transform((val) => parseInt(val))]).nullable().optional().default(10),
    durationMs: z.union([z.number(), z.string().transform((val) => parseInt(val))]).nullable().optional(),
    cacheForOffline: z.boolean().optional().default(false),
}).superRefine((data, ctx) => {
    if (data.type !== "web" && !data.filename) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Filename is required for image/video",
            path: ["filename"],
        });
    }
});

const SyncPresetModeValues = [SYNC_PRESET_MODE.COMMON, SYNC_PRESET_MODE.PER_DEVICE] as const;
const SyncSessionDeviceStatusValues = [
    SYNC_SESSION_DEVICE_STATUS.ASSIGNED,
    SYNC_SESSION_DEVICE_STATUS.PRELOADING,
    SYNC_SESSION_DEVICE_STATUS.READY,
    SYNC_SESSION_DEVICE_STATUS.WARMING_UP,
    SYNC_SESSION_DEVICE_STATUS.PLAYING,
    SYNC_SESSION_DEVICE_STATUS.ERRORED,
    SYNC_SESSION_DEVICE_STATUS.DISCONNECTED,
] as const;
const SyncStopReasonValues = [
    SYNC_STOP_REASON.USER_STOP,
    SYNC_STOP_REASON.TIMEOUT,
    SYNC_STOP_REASON.ERROR,
] as const;
const SyncDriftQualityValues = [
    SYNC_DRIFT_QUALITY.EXCELLENT,
    SYNC_DRIFT_QUALITY.GOOD,
    SYNC_DRIFT_QUALITY.FAIR,
    SYNC_DRIFT_QUALITY.POOR,
    SYNC_DRIFT_QUALITY.CRITICAL,
] as const;
const SyncDeviceCommandTypeValues = [
    SYNC_DEVICE_COMMAND_TYPE.SYNC_PREPARE,
    SYNC_DEVICE_COMMAND_TYPE.SYNC_STOP,
] as const;
const SyncDeviceCommandStatusValues = [
    SYNC_DEVICE_COMMAND_STATUS.PENDING,
    SYNC_DEVICE_COMMAND_STATUS.ACKED,
    SYNC_DEVICE_COMMAND_STATUS.FAILED,
] as const;

export const SyncPresetDeviceAssignmentSchema = z.object({
    deviceId: z.string().min(1, "Device ID is required").transform(sanitize),
    mediaItemId: z.string().min(1).transform(sanitize).optional().nullable(),
});

export const SyncPresetContentProfileSchema = z.object({
    maxResolution: z.enum(["720p", "1080p", "1440p", "2160p"]).optional(),
    motionIntensity: z.enum(["low", "medium", "high"]).optional(),
    hasText: z.boolean().optional().default(false),
});

export const CreateSyncPresetSchema = z.object({
    name: z.string().min(1, "Preset name is required").max(100, "Name is too long").transform(sanitize),
    mode: z.enum(SyncPresetModeValues).default(SYNC_PRESET_MODE.COMMON),
    durationMs: z.number().int().positive("Duration must be a positive integer"),
    presetMediaId: z.string().min(1).transform(sanitize).optional().nullable(),
    devices: z.array(SyncPresetDeviceAssignmentSchema).min(1, "At least one device is required"),
    contentProfile: SyncPresetContentProfileSchema.optional(),
}).superRefine((data, ctx) => {
    if (data.mode === SYNC_PRESET_MODE.COMMON && !data.presetMediaId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "presetMediaId is required when mode is COMMON",
            path: ["presetMediaId"],
        });
    }

    if (data.mode === SYNC_PRESET_MODE.PER_DEVICE) {
        const invalidDevice = data.devices.find((device) => !device.mediaItemId);
        if (invalidDevice) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Each device must have mediaItemId when mode is PER_DEVICE",
                path: ["devices"],
            });
        }
    }

    const uniqueDeviceCount = new Set(data.devices.map((device) => device.deviceId)).size;
    if (uniqueDeviceCount !== data.devices.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Devices must be unique within a preset",
            path: ["devices"],
        });
    }
});

export const UpdateSyncPresetSchema = z.object({
    name: z.string().min(1).max(100).transform(sanitize).optional(),
    mode: z.enum(SyncPresetModeValues).optional(),
    durationMs: z.number().int().positive().optional(),
    presetMediaId: z.string().min(1).transform(sanitize).optional().nullable(),
    devices: z.array(SyncPresetDeviceAssignmentSchema).min(1).optional(),
    contentProfile: SyncPresetContentProfileSchema.optional(),
});

export const StartSyncSessionSchema = z.object({
    presetId: z.string().min(1, "presetId is required").transform(sanitize),
    startTimeoutMs: z.number().int().min(10000).max(20000).optional().default(15000),
    preparationBufferMs: z.number().int().min(8000).max(12000).optional(),
});

export const StopSyncSessionSchema = z.object({
    sessionId: z.string().min(1, "sessionId is required").transform(sanitize),
    reason: z.enum(SyncStopReasonValues).optional().default(SYNC_STOP_REASON.USER_STOP),
});

export const SyncPrepareCommandSchema = z.object({
    type: z.literal("sync.prepare"),
    sessionId: z.string().min(1).transform(sanitize),
    presetId: z.string().min(1).transform(sanitize),
    startAtMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive(),
    media: z.object({
        mode: z.enum(["common", "per_device"]),
        mediaId: z.string().min(1).transform(sanitize),
        localPath: z.string().min(1),
        resolution: z.string().optional(),
        fps: z.number().positive().optional(),
        codec: z.string().optional(),
    }),
    syncConfig: z.object({
        hardResyncThresholdMs: z.number().int().positive(),
        softCorrectionRangeMs: z.tuple([z.number().int().nonnegative(), z.number().int().positive()]),
        deadbandMs: z.number().int().nonnegative(),
        warmupLoops: z.number().int().min(1).max(10),
    }),
});

export const SyncStopCommandSchema = z.object({
    type: z.literal("sync.stop"),
    sessionId: z.string().min(1).transform(sanitize),
    reason: z.enum(SyncStopReasonValues),
});

export const SyncStatusSchema = z.object({
    type: z.literal("sync.status"),
    sessionId: z.string().min(1).transform(sanitize),
    deviceId: z.string().min(1).transform(sanitize),
    status: z.enum(SyncSessionDeviceStatusValues),
    nowMs: z.number().int().nonnegative(),
    driftMs: z.number(),
    driftQuality: z.enum(SyncDriftQualityValues).optional(),
    resyncCount: z.number().int().nonnegative().optional(),
    warmupProgress: z.number().int().nonnegative().optional(),
    health: z.object({
        avgDriftMs: z.number().optional(),
        maxDriftMs: z.number().optional(),
        resyncRate: z.number().optional(),
        clockOffsetMs: z.number().optional(),
        cpuTempC: z.number().optional(),
        throttled: z.boolean().optional(),
        healthScore: z.number().min(0).max(1).optional(),
    }).optional(),
    mpv: z.object({
        timePosMs: z.number().nonnegative().optional(),
        paused: z.boolean().optional(),
        playbackSpeed: z.number().positive().optional(),
        droppedFrames: z.number().int().nonnegative().optional(),
        decoderFrameDrops: z.number().int().nonnegative().optional(),
    }).optional(),
});

export const DeviceCommandsPollSchema = z.object({
    device_token: z.string().min(1, "device_token is required").transform(sanitize),
    limit: z.union([z.number(), z.string().transform((val) => parseInt(val, 10))]).optional().default(10),
});

export const DeviceCommandAckSchema = z.object({
    device_token: z.string().min(1, "device_token is required").transform(sanitize),
    command_id: z.string().min(1, "command_id is required").transform(sanitize),
    status: z.enum(SyncDeviceCommandStatusValues).optional().default(SYNC_DEVICE_COMMAND_STATUS.ACKED),
    error: z.string().max(1000).optional(),
    sync_status: z.enum(SyncSessionDeviceStatusValues).optional(),
    sync_runtime: z
        .object({
            session_id: z.string().min(1).optional(),
            status: z.string().optional(),
            drift_ms: z.number().optional(),
            resync_count: z.number().optional(),
            clock_offset_ms: z.number().optional(),
            cpu_temp: z.number().optional(),
            throttled: z.boolean().optional(),
            health_score: z.number().optional(),
            avg_drift_ms: z.number().optional(),
            max_drift_ms: z.number().optional(),
            resync_rate: z.number().optional(),
        })
        .optional(),
});

export const SyncDeviceCommandEnvelopeSchema = z.object({
    id: z.string(),
    sessionId: z.string(),
    type: z.enum(SyncDeviceCommandTypeValues),
    payload: z.record(z.string(), z.unknown()),
    status: z.enum(SyncDeviceCommandStatusValues),
    createdAt: z.date().or(z.string()),
});
