export const DEVICE_ONLINE_WINDOW_MS = 5 * 60_000;

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
