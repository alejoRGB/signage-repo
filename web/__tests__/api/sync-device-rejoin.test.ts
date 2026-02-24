/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { maybeQueueSyncRejoinPrepareOnHeartbeat } from "@/lib/sync-device-rejoin";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        syncSessionDevice: {
            findFirst: jest.fn(),
        },
        syncDeviceCommand: {
            findFirst: jest.fn(),
            createMany: jest.fn(),
        },
    },
}));

describe("sync-device-rejoin", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("queues SYNC_PREPARE for a stale device assigned to an active session", async () => {
        const nowMs = 1_700_000_100_000;
        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue({
            id: "session-device-1",
            sessionId: "session-1",
            status: "PLAYING",
            lastSeenAt: new Date(nowMs - 60_000),
            session: {
                id: "session-1",
                presetId: "preset-1",
                durationMs: 30_000,
                startAtMs: BigInt(nowMs - 20_000),
                masterDeviceId: "device-master",
                preset: {
                    mode: "COMMON",
                    presetMedia: {
                        id: "media-1",
                        filename: "wall.mp4",
                        width: 1920,
                        height: 1080,
                        fps: 30,
                    },
                    devices: [],
                },
            },
        });
        (prisma.syncDeviceCommand.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.syncDeviceCommand.createMany as jest.Mock).mockResolvedValue({ count: 1 });

        const result = await maybeQueueSyncRejoinPrepareOnHeartbeat("device-1", { nowMs });

        expect(result).toEqual({
            queued: true,
            sessionId: "session-1",
            deviceId: "device-1",
        });
        expect(prisma.syncDeviceCommand.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: [
                    expect.objectContaining({
                        deviceId: "device-1",
                        sessionId: "session-1",
                        type: "SYNC_PREPARE",
                        dedupeKey: expect.stringContaining("session-1:DEVICE_REJOIN:"),
                    }),
                ],
                skipDuplicates: true,
            })
        );
    });

    it("does not queue when session heartbeat for that device is still fresh", async () => {
        const nowMs = 1_700_000_100_000;
        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue({
            id: "session-device-1",
            sessionId: "session-1",
            status: "PLAYING",
            lastSeenAt: new Date(nowMs - 2_000),
            session: {
                id: "session-1",
                presetId: "preset-1",
                durationMs: 30_000,
                startAtMs: BigInt(nowMs - 20_000),
                masterDeviceId: "device-master",
                preset: {
                    mode: "COMMON",
                    presetMedia: {
                        id: "media-1",
                        filename: "wall.mp4",
                        width: 1920,
                        height: 1080,
                        fps: 30,
                    },
                    devices: [],
                },
            },
        });

        const result = await maybeQueueSyncRejoinPrepareOnHeartbeat("device-1", { nowMs });

        expect(result).toEqual({ queued: false, reason: "SESSION_HEARTBEAT_FRESH" });
        expect(prisma.syncDeviceCommand.findFirst).not.toHaveBeenCalled();
        expect(prisma.syncDeviceCommand.createMany).not.toHaveBeenCalled();
    });

    it("does not queue duplicate prepare if one is already pending", async () => {
        const nowMs = 1_700_000_200_000;
        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue({
            id: "session-device-1",
            sessionId: "session-1",
            status: "DISCONNECTED",
            lastSeenAt: new Date(nowMs - 60_000),
            session: {
                id: "session-1",
                presetId: "preset-1",
                durationMs: 30_000,
                startAtMs: BigInt(nowMs - 20_000),
                masterDeviceId: "device-master",
                preset: {
                    mode: "COMMON",
                    presetMedia: {
                        id: "media-1",
                        filename: "wall.mp4",
                        width: 1920,
                        height: 1080,
                        fps: 30,
                    },
                    devices: [],
                },
            },
        });
        (prisma.syncDeviceCommand.findFirst as jest.Mock).mockResolvedValue({ id: "cmd-1" });

        const result = await maybeQueueSyncRejoinPrepareOnHeartbeat("device-1", { nowMs });

        expect(result).toEqual({ queued: false, reason: "PENDING_PREPARE_EXISTS" });
        expect(prisma.syncDeviceCommand.createMany).not.toHaveBeenCalled();
    });
});
