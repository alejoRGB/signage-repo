/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { extractSyncRuntimeFromFormData, extractSyncRuntimeFromJson, persistDeviceSyncRuntime } from "@/lib/sync-runtime-service";
import { abortExpiredSyncStartSessionById } from "@/lib/sync-start-timeout-service";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        syncSessionDevice: {
            findFirst: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
        },
        syncSession: {
            findFirst: jest.fn(),
            updateMany: jest.fn(),
            update: jest.fn(),
        },
        syncDeviceCommand: {
            createMany: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

jest.mock("@/lib/sync-start-timeout-service", () => ({
    abortExpiredSyncStartSessionById: jest.fn().mockResolvedValue(false),
}));

describe("sync-runtime-service LAN runtime fields", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (abortExpiredSyncStartSessionById as jest.Mock).mockResolvedValue(false);
    });

    it("extracts and normalizes lan fields from JSON payload", () => {
        const runtime = extractSyncRuntimeFromJson({
            sync_runtime: {
                session_id: "session-1",
                status: "PLAYING",
                runtime_sent_at_ms: 123456,
                lan_mode: "FOLLOWER",
                lan_beacon_age_ms: 41.9,
            },
        });

        expect(runtime).toEqual(
            expect.objectContaining({
                sessionId: "session-1",
                runtimeSentAtMs: 123456,
                lanMode: "follower",
                lanBeaconAgeMs: 41.9,
            })
        );
    });

    it("extracts and normalizes lan fields from form data", () => {
        const formData = new FormData();
        formData.set("sync_session_id", "session-1");
        formData.set("sync_status", "PLAYING");
        formData.set("sync_runtime_sent_at_ms", "999");
        formData.set("sync_lan_mode", " CLOUD_FALLBACK ");
        formData.set("sync_lan_beacon_age_ms", "123");

        const runtime = extractSyncRuntimeFromFormData(formData);
        expect(runtime).toEqual(
            expect.objectContaining({
                sessionId: "session-1",
                runtimeSentAtMs: 999,
                lanMode: "cloud_fallback",
                lanBeaconAgeMs: 123,
            })
        );
    });

    it("does not regress device status when an older state arrives later", async () => {
        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue({
            id: "session-device-1",
            sessionId: "session-1",
            status: "PLAYING",
            lastRuntimeSentAtMs: BigInt(2000),
            driftHistory: null,
            session: { id: "session-1", status: "RUNNING" },
        });

        await persistDeviceSyncRuntime("device-1", {
            sessionId: "session-1",
            status: "READY",
            runtimeSentAtMs: 1000,
            driftMs: 4,
        });

        expect(prisma.syncSessionDevice.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "session-device-1" },
                data: { lastSeenAt: expect.any(Date) },
            })
        );
    });

    it("ignores unordered runtime once ordered runtime has been recorded", async () => {
        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue({
            id: "session-device-2",
            sessionId: "session-1",
            status: "PLAYING",
            lastRuntimeSentAtMs: BigInt(5000),
            driftHistory: null,
            session: { id: "session-1", status: "RUNNING" },
        });

        await persistDeviceSyncRuntime("device-1", {
            sessionId: "session-1",
            status: "ERRORED",
            driftMs: 999,
        });

        expect(prisma.syncSessionDevice.update).toHaveBeenCalledWith({
            where: { id: "session-device-2" },
            data: { lastSeenAt: expect.any(Date) },
        });
        expect(prisma.syncSession.update).not.toHaveBeenCalled();
    });

    it("stores lastRuntimeSentAtMs when ordered runtime is accepted", async () => {
        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue({
            id: "session-device-3",
            sessionId: "session-1",
            status: "ASSIGNED",
            lastRuntimeSentAtMs: null,
            driftHistory: null,
            session: { id: "session-1", status: "RUNNING" },
        });

        await persistDeviceSyncRuntime("device-1", {
            sessionId: "session-1",
            status: "READY",
            runtimeSentAtMs: 1234567890,
            driftMs: 10,
        });

        expect(prisma.syncSessionDevice.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "session-device-3" },
                data: expect.objectContaining({
                    lastRuntimeSentAtMs: BigInt(1234567890),
                    status: "READY",
                }),
            })
        );
    });

    it("persists lan runtime fields into SyncSessionDevice", async () => {
        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue({
            id: "session-device-1",
            sessionId: "session-1",
            lastRuntimeSentAtMs: null,
            driftHistory: null,
            session: { id: "session-1", status: "RUNNING" },
        });

        await persistDeviceSyncRuntime("device-1", {
            sessionId: "session-1",
            status: "ASSIGNED",
            lanMode: "follower",
            lanBeaconAgeMs: 88.7,
        });

        expect(prisma.syncSessionDevice.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "session-device-1" },
                data: expect.objectContaining({
                    lanMode: "follower",
                    lanBeaconAgeMs: 89,
                }),
            })
        );
    });

    it("aborts processing runtime when start timeout has expired", async () => {
        (abortExpiredSyncStartSessionById as jest.Mock).mockResolvedValue(true);

        await persistDeviceSyncRuntime("device-1", {
            sessionId: "session-timeout",
            status: "READY",
        });

        expect(abortExpiredSyncStartSessionById).toHaveBeenCalledWith("session-timeout");
        expect(prisma.syncSessionDevice.findFirst).not.toHaveBeenCalled();
        expect(prisma.syncSessionDevice.update).not.toHaveBeenCalled();
    });

    it("waits for all devices READY before scheduling coordinated start", async () => {
        const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
        const tx = {
            syncSession: {
                findFirst: jest.fn().mockResolvedValue({
                    id: "session-1",
                    presetId: "preset-1",
                    durationMs: 30_000,
                    preparationBufferMs: 8_000,
                    masterDeviceId: "device-1",
                    preset: {
                        mode: "COMMON",
                        presetMedia: {
                            id: "media-1",
                            filename: "video.mp4",
                            width: 1920,
                            height: 1080,
                            fps: 30,
                        },
                        devices: [],
                    },
                    devices: [
                        { deviceId: "device-1", status: "READY" },
                        { deviceId: "device-2", status: "READY" },
                    ],
                }),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            syncDeviceCommand: {
                createMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
        };

        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue({
            id: "session-device-1",
            sessionId: "session-1",
            lastRuntimeSentAtMs: null,
            driftHistory: null,
            session: { id: "session-1", status: "STARTING" },
        });
        (prisma.syncSessionDevice.count as jest.Mock).mockResolvedValue(0);
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));

        try {
            await persistDeviceSyncRuntime("device-1", {
                sessionId: "session-1",
                status: "READY",
            });
        } finally {
            nowSpy.mockRestore();
        }

        expect(tx.syncSession.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: "session-1",
                }),
                data: expect.objectContaining({
                    status: "WARMING_UP",
                    startAtMs: BigInt(1_700_000_008_000),
                }),
            })
        );
        expect(tx.syncDeviceCommand.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.arrayContaining([
                    expect.objectContaining({
                        deviceId: "device-1",
                        sessionId: "session-1",
                        type: "SYNC_PREPARE",
                        dedupeKey: "session-1:READY_BARRIER:1700000008000:device-1",
                    }),
                    expect.objectContaining({
                        deviceId: "device-2",
                        sessionId: "session-1",
                        type: "SYNC_PREPARE",
                        dedupeKey: "session-1:READY_BARRIER:1700000008000:device-2",
                    }),
                ]),
                skipDuplicates: true,
            })
        );
    });
});
