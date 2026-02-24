/**
 * @jest-environment node
 */
import { buildPreparePayload } from "@/lib/sync-command-service";

jest.mock("@/lib/prisma", () => ({
    prisma: {},
}));

describe("buildPreparePayload LAN auth", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
        delete process.env.SYNC_LAN_BEACON_SECRET;
        delete process.env.NEXTAUTH_SECRET;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("includes a deterministic per-session LAN auth key when secret is configured", () => {
        process.env.SYNC_LAN_BEACON_SECRET = "test-root-secret";

        const payload1 = buildPreparePayload({
            sessionId: "session-1",
            presetId: "preset-1",
            mode: "COMMON",
            startAtMs: 1000,
            durationMs: 10000,
            deviceId: "device-1",
            media: {
                mediaId: "media-1",
                filename: "video.mp4",
                width: 1920,
                height: 1080,
                fps: 30,
            },
        }) as Record<string, unknown>;
        const payload2 = buildPreparePayload({
            sessionId: "session-1",
            presetId: "preset-1",
            mode: "COMMON",
            startAtMs: 1000,
            durationMs: 10000,
            deviceId: "device-2",
            media: {
                mediaId: "media-1",
                filename: "video.mp4",
                width: 1920,
                height: 1080,
                fps: 30,
            },
        }) as Record<string, unknown>;

        const lan1 = ((payload1.sync_config as Record<string, unknown>).lan as Record<string, unknown>);
        const lan2 = ((payload2.sync_config as Record<string, unknown>).lan as Record<string, unknown>);

        expect(lan1.auth_alg).toBe("hmac-sha256");
        expect(typeof lan1.auth_key).toBe("string");
        expect((lan1.auth_key as string).length).toBeGreaterThan(20);
        expect(lan1.auth_key).toBe(lan2.auth_key);
    });

    it("omits LAN auth key when no server secret is configured", () => {
        const payload = buildPreparePayload({
            sessionId: "session-1",
            presetId: "preset-1",
            mode: "COMMON",
            startAtMs: 1000,
            durationMs: 10000,
            deviceId: "device-1",
            media: {
                mediaId: "media-1",
                filename: "video.mp4",
                width: 1920,
                height: 1080,
                fps: 30,
            },
        }) as Record<string, unknown>;

        const lan = ((payload.sync_config as Record<string, unknown>).lan as Record<string, unknown>);
        expect(lan.auth_key).toBeUndefined();
        expect(lan.auth_alg).toBeUndefined();
    });
});

