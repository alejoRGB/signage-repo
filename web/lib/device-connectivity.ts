import { DIRECTIVE_TAB, type DirectiveTab } from "@/lib/directive-tabs";

// Player reports heartbeat every ~5s. We allow a small buffer before declaring offline.
export const DEVICE_HEARTBEAT_INTERVAL_MS = 5_000;
export const DEVICE_ONLINE_WINDOW_MS = 15_000;

export const DEVICE_STATUS_POLL_INTERVAL_MS_BY_TAB: Record<DirectiveTab, number> = {
    [DIRECTIVE_TAB.SCHEDULES]: 15_000,
    [DIRECTIVE_TAB.SYNC_VIDEOWALL]: 5_000,
};

type LastSeenInput = Date | string | null | undefined;

function toLastSeenMs(lastSeenAt: LastSeenInput): number | null {
    if (!lastSeenAt) {
        return null;
    }

    if (lastSeenAt instanceof Date) {
        return Number.isNaN(lastSeenAt.getTime()) ? null : lastSeenAt.getTime();
    }

    const parsedMs = Date.parse(lastSeenAt);
    return Number.isNaN(parsedMs) ? null : parsedMs;
}

export function isDeviceConsideredOnline(lastSeenAt: LastSeenInput, nowMs = Date.now()) {
    const lastSeenMs = toLastSeenMs(lastSeenAt);
    if (lastSeenMs === null) {
        return false;
    }

    return nowMs - lastSeenMs <= DEVICE_ONLINE_WINDOW_MS;
}

export function getDeviceConnectivityStatus(lastSeenAt: LastSeenInput, nowMs = Date.now()) {
    return isDeviceConsideredOnline(lastSeenAt, nowMs) ? "online" : "offline";
}

export function getDeviceStatusPollIntervalMs(tab: DirectiveTab) {
    return DEVICE_STATUS_POLL_INTERVAL_MS_BY_TAB[tab];
}
