import { describe, it, expect } from "vitest";
import {
    DEVICE_ONLINE_WINDOW_MS,
    getDeviceConnectivityStatus,
    getDeviceStatusPollIntervalMs,
    isDeviceConsideredOnline,
} from "@/lib/device-connectivity";
import { DIRECTIVE_TAB } from "@/lib/directive-tabs";

describe("device-connectivity", () => {
    it("uses tab-specific polling intervals", () => {
        expect(getDeviceStatusPollIntervalMs(DIRECTIVE_TAB.SCHEDULES)).toBe(15_000);
        expect(getDeviceStatusPollIntervalMs(DIRECTIVE_TAB.SYNC_VIDEOWALL)).toBe(5_000);
    });

    it("treats heartbeat exactly on the online window boundary as online", () => {
        const nowMs = 1_000_000;
        const lastSeenAt = new Date(nowMs - DEVICE_ONLINE_WINDOW_MS);

        expect(isDeviceConsideredOnline(lastSeenAt, nowMs)).toBe(true);
        expect(getDeviceConnectivityStatus(lastSeenAt, nowMs)).toBe("online");
    });

    it("marks stale heartbeat as offline", () => {
        const nowMs = 1_000_000;
        const lastSeenAt = new Date(nowMs - DEVICE_ONLINE_WINDOW_MS - 1);

        expect(isDeviceConsideredOnline(lastSeenAt, nowMs)).toBe(false);
        expect(getDeviceConnectivityStatus(lastSeenAt, nowMs)).toBe("offline");
    });
});
