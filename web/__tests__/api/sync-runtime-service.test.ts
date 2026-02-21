/**
 * @jest-environment node
 */
import { prisma } from "@/lib/prisma";
import { extractSyncRuntimeFromFormData, extractSyncRuntimeFromJson, persistDeviceSyncRuntime } from "@/lib/sync-runtime-service";

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

describe("sync-runtime-service LAN runtime fields", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("extracts and normalizes lan fields from JSON payload", () => {
        const runtime = extractSyncRuntimeFromJson({
            sync_runtime: {
                session_id: "session-1",
                status: "PLAYING",
                lan_mode: "FOLLOWER",
                lan_beacon_age_ms: 41.9,
            },
        });

        expect(runtime).toEqual(
            expect.objectContaining({
                sessionId: "session-1",
                lanMode: "follower",
                lanBeaconAgeMs: 41.9,
            })
        );
    });

    it("extracts and normalizes lan fields from form data", () => {
        const formData = new FormData();
        formData.set("sync_session_id", "session-1");
        formData.set("sync_status", "PLAYING");
        formData.set("sync_lan_mode", " CLOUD_FALLBACK ");
        formData.set("sync_lan_beacon_age_ms", "123");

        const runtime = extractSyncRuntimeFromFormData(formData);
        expect(runtime).toEqual(
            expect.objectContaining({
                sessionId: "session-1",
                lanMode: "cloud_fallback",
                lanBeaconAgeMs: 123,
            })
        );
    });

    it("persists lan runtime fields into SyncSessionDevice", async () => {
        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue({
            id: "session-device-1",
            sessionId: "session-1",
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
