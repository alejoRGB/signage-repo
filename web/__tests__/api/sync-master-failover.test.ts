/**
 * @jest-environment node
 */
import { POST as START_SYNC } from "@/app/api/sync/session/start/route";
import { prisma } from "@/lib/prisma";
import {
    DEFAULT_MASTER_HEARTBEAT_TIMEOUT_MS,
    maybeReelectMasterForSession,
    selectInitialMasterDeviceId,
} from "@/lib/sync-master-election";
import { getServerSession } from "next-auth";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        syncPreset: {
            findFirst: jest.fn(),
        },
        syncSession: {
            findFirst: jest.fn(),
        },
        syncSessionDevice: {
            findFirst: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
    authOptions: {},
}));

describe("SYNC-014 master election and failover", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("selectInitialMasterDeviceId picks the most recently seen device", () => {
        const newest = new Date();
        const older = new Date(newest.getTime() - 10_000);

        const masterId = selectInitialMasterDeviceId([
            { deviceId: "device-older", lastSeenAt: older },
            { deviceId: "device-newest", lastSeenAt: newest },
        ]);

        expect(masterId).toBe("device-newest");
    });

    it("start session persists the selected masterDeviceId", async () => {
        const now = Date.now();
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.syncSession.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.syncPreset.findFirst as jest.Mock).mockResolvedValue({
            id: "preset-1",
            mode: "COMMON",
            durationMs: 10000,
            presetMedia: {
                id: "media-1",
                filename: "video.mp4",
                width: 1920,
                height: 1080,
                fps: 30,
            },
            devices: [
                {
                    deviceId: "device-stale",
                    device: { id: "device-stale", lastSeenAt: new Date(now - 10_000) },
                    mediaItem: null,
                },
                {
                    deviceId: "device-fresh",
                    device: { id: "device-fresh", lastSeenAt: new Date(now - 1_000) },
                    mediaItem: null,
                },
            ],
        });

        const tx = {
            syncSession: {
                create: jest.fn().mockResolvedValue({ id: "session-1" }),
                findUnique: jest.fn().mockResolvedValue({
                    id: "session-1",
                    status: "STARTING",
                    masterDeviceId: "device-fresh",
                    startAtMs: BigInt(now + 8000),
                }),
            },
            syncSessionDevice: {
                createMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
            syncDeviceCommand: {
                createMany: jest.fn().mockResolvedValue({ count: 3 }),
            },
        };
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));

        const request = new Request("http://localhost/api/sync/session/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ presetId: "preset-1" }),
        });

        const response = await START_SYNC(request);
        expect(response.status).toBe(201);
        expect(tx.syncSession.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    masterDeviceId: "device-fresh",
                }),
            })
        );
    });

    it("maybeReelectMasterForSession elects a new master and enqueues notify commands", async () => {
        const nowMs = Date.now();
        (prisma.syncSession.findFirst as jest.Mock).mockResolvedValue({
            id: "session-1",
            presetId: "preset-1",
            status: "RUNNING",
            durationMs: 10000,
            startAtMs: BigInt(nowMs - 5000),
            masterDeviceId: "device-old-master",
            preset: {
                mode: "COMMON",
                presetMedia: {
                    id: "media-1",
                    filename: "video.mp4",
                    width: 1920,
                    height: 1080,
                    fps: 30,
                },
                devices: [
                    { deviceId: "device-old-master", mediaItem: null },
                    { deviceId: "device-next-master", mediaItem: null },
                    { deviceId: "device-other", mediaItem: null },
                ],
            },
            devices: [
                {
                    deviceId: "device-old-master",
                    status: "PLAYING",
                    lastSeenAt: new Date(nowMs - (DEFAULT_MASTER_HEARTBEAT_TIMEOUT_MS + 1000)),
                    healthScore: 0.9,
                    device: {
                        lastSeenAt: new Date(nowMs - (DEFAULT_MASTER_HEARTBEAT_TIMEOUT_MS + 1000)),
                    },
                },
                {
                    deviceId: "device-next-master",
                    status: "PLAYING",
                    lastSeenAt: new Date(nowMs - 500),
                    healthScore: 0.98,
                    device: {
                        lastSeenAt: new Date(nowMs - 500),
                    },
                },
                {
                    deviceId: "device-other",
                    status: "PLAYING",
                    lastSeenAt: new Date(nowMs - 900),
                    healthScore: 0.95,
                    device: {
                        lastSeenAt: new Date(nowMs - 900),
                    },
                },
            ],
        });

        const tx = {
            syncSession: {
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            syncDeviceCommand: {
                createMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
        };
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));

        const result = await maybeReelectMasterForSession("session-1", { nowMs });

        expect(result).toEqual(
            expect.objectContaining({
                changed: true,
                previousMasterDeviceId: "device-old-master",
                nextMasterDeviceId: "device-next-master",
            })
        );
        expect(tx.syncSession.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { masterDeviceId: "device-next-master" },
            })
        );
        expect(tx.syncDeviceCommand.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.arrayContaining([
                    expect.objectContaining({
                        deviceId: "device-next-master",
                        type: "SYNC_PREPARE",
                    }),
                    expect.objectContaining({
                        deviceId: "device-old-master",
                        type: "SYNC_PREPARE",
                    }),
                    expect.objectContaining({
                        deviceId: "device-other",
                        type: "SYNC_PREPARE",
                    }),
                ]),
            })
        );
    });

    it("maybeReelectMasterForSession keeps current master when heartbeat is healthy", async () => {
        const nowMs = Date.now();
        (prisma.syncSession.findFirst as jest.Mock).mockResolvedValue({
            id: "session-1",
            presetId: "preset-1",
            status: "RUNNING",
            durationMs: 10000,
            startAtMs: BigInt(nowMs - 5000),
            masterDeviceId: "device-master",
            preset: {
                mode: "COMMON",
                presetMedia: {
                    id: "media-1",
                    filename: "video.mp4",
                    width: 1920,
                    height: 1080,
                    fps: 30,
                },
                devices: [{ deviceId: "device-master", mediaItem: null }],
            },
            devices: [
                {
                    deviceId: "device-master",
                    status: "PLAYING",
                    lastSeenAt: new Date(nowMs - 1000),
                    healthScore: 0.9,
                    device: { lastSeenAt: new Date(nowMs - 1000) },
                },
            ],
        });

        const result = await maybeReelectMasterForSession("session-1", { nowMs });

        expect(result).toEqual({ changed: false, reason: "MASTER_HEALTHY" });
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
