export const SYNC_PRESET_MODE = {
    COMMON: "COMMON",
    PER_DEVICE: "PER_DEVICE",
} as const;

export type SyncPresetMode = (typeof SYNC_PRESET_MODE)[keyof typeof SYNC_PRESET_MODE];

export const SYNC_SESSION_STATUS = {
    CREATED: "CREATED",
    STARTING: "STARTING",
    WARMING_UP: "WARMING_UP",
    RUNNING: "RUNNING",
    STOPPED: "STOPPED",
    ABORTED: "ABORTED",
} as const;

export type SyncSessionStatus = (typeof SYNC_SESSION_STATUS)[keyof typeof SYNC_SESSION_STATUS];

export const SYNC_SESSION_DEVICE_STATUS = {
    ASSIGNED: "ASSIGNED",
    PRELOADING: "PRELOADING",
    READY: "READY",
    WARMING_UP: "WARMING_UP",
    PLAYING: "PLAYING",
    ERRORED: "ERRORED",
    DISCONNECTED: "DISCONNECTED",
} as const;

export type SyncSessionDeviceStatus =
    (typeof SYNC_SESSION_DEVICE_STATUS)[keyof typeof SYNC_SESSION_DEVICE_STATUS];

export const SYNC_STOP_REASON = {
    USER_STOP: "USER_STOP",
    TIMEOUT: "TIMEOUT",
    ERROR: "ERROR",
} as const;

export type SyncStopReason = (typeof SYNC_STOP_REASON)[keyof typeof SYNC_STOP_REASON];

export const SYNC_DRIFT_QUALITY = {
    EXCELLENT: "EXCELLENT",
    GOOD: "GOOD",
    FAIR: "FAIR",
    POOR: "POOR",
    CRITICAL: "CRITICAL",
} as const;

export type SyncDriftQuality = (typeof SYNC_DRIFT_QUALITY)[keyof typeof SYNC_DRIFT_QUALITY];

export const SYNC_DEVICE_COMMAND_TYPE = {
    SYNC_PREPARE: "SYNC_PREPARE",
    SYNC_STOP: "SYNC_STOP",
} as const;

export type SyncDeviceCommandType =
    (typeof SYNC_DEVICE_COMMAND_TYPE)[keyof typeof SYNC_DEVICE_COMMAND_TYPE];

export const SYNC_DEVICE_COMMAND_STATUS = {
    PENDING: "PENDING",
    ACKED: "ACKED",
    FAILED: "FAILED",
} as const;

export type SyncDeviceCommandStatus =
    (typeof SYNC_DEVICE_COMMAND_STATUS)[keyof typeof SYNC_DEVICE_COMMAND_STATUS];

export const SYNC_LOG_EVENT = {
    READY: "READY",
    STARTED: "STARTED",
    SOFT_CORRECTION: "SOFT_CORRECTION",
    HARD_RESYNC: "HARD_RESYNC",
    REJOIN: "REJOIN",
    MPV_CRASH: "MPV_CRASH",
    THERMAL_THROTTLE: "THERMAL_THROTTLE",
} as const;

export type SyncLogEvent = (typeof SYNC_LOG_EVENT)[keyof typeof SYNC_LOG_EVENT];
