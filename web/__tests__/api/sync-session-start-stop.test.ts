/**
 * @jest-environment node
 */
import { POST as START_SYNC } from "@/app/api/sync/session/start/route";
import { POST as STOP_SYNC } from "@/app/api/sync/session/stop/route";
import { GET as GET_ACTIVE_SYNC } from "@/app/api/sync/session/active/route";
import { prisma } from "@/lib/prisma";
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

describe("Sync session API", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("START returns 401 when unauthenticated", async () => {
        (getServerSession as jest.Mock).mockResolvedValue(null);

        const request = new Request("http://localhost/api/sync/session/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ presetId: "preset-1" }),
        });

        const response = await START_SYNC(request);
        expect(response.status).toBe(401);
    });

    it("START creates a new sync session", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.syncSession.findFirst as jest.Mock).mockResolvedValue(null);
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
                    deviceId: "device-1",
                    device: { id: "device-1", name: "Lobby", lastSeenAt: new Date() },
                    mediaItem: null,
                },
                {
                    deviceId: "device-2",
                    device: { id: "device-2", name: "Window", lastSeenAt: new Date() },
                    mediaItem: null,
                },
            ],
        });
        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue(null);

        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
            callback({
                syncSession: {
                    create: jest.fn().mockResolvedValue({ id: "session-1" }),
                    findUnique: jest.fn().mockResolvedValue({
                        id: "session-1",
                        status: "STARTING",
                        startAtMs: BigInt(1739650000000),
                    }),
                },
                syncSessionDevice: {
                    createMany: jest.fn().mockResolvedValue({ count: 2 }),
                },
                syncDeviceCommand: {
                    createMany: jest.fn().mockResolvedValue({ count: 2 }),
                },
            })
        );

        const request = new Request("http://localhost/api/sync/session/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ presetId: "preset-1" }),
        });

        const response = await START_SYNC(request);
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body.session.id).toBe("session-1");
        expect(typeof body.session.startAtMs).toBe("number");
    });

    it("START rejects when any device is already in active session", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.syncSession.findFirst as jest.Mock).mockResolvedValue(null);
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
                    deviceId: "device-1",
                    device: { id: "device-1", name: "Lobby", lastSeenAt: new Date() },
                    mediaItem: null,
                },
                {
                    deviceId: "device-2",
                    device: { id: "device-2", name: "Window", lastSeenAt: new Date() },
                    mediaItem: null,
                },
            ],
        });
        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue({
            deviceId: "device-1",
            sessionId: "session-existing",
        });

        const request = new Request("http://localhost/api/sync/session/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ presetId: "preset-1" }),
        });

        const response = await START_SYNC(request);
        expect(response.status).toBe(409);
    });

    it("START rejects when any selected device is offline", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.syncSession.findFirst as jest.Mock).mockResolvedValue(null);
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
                    deviceId: "device-1",
                    device: { id: "device-1", name: "Lobby", lastSeenAt: new Date() },
                    mediaItem: null,
                },
                {
                    deviceId: "device-2",
                    device: { id: "device-2", name: "Window", lastSeenAt: null },
                    mediaItem: null,
                },
            ],
        });
        (prisma.syncSessionDevice.findFirst as jest.Mock).mockResolvedValue(null);

        const request = new Request("http://localhost/api/sync/session/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ presetId: "preset-1" }),
        });

        const response = await START_SYNC(request);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toMatch(/must be online/i);
        expect(body.offlineDevices).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ deviceId: "device-2", reason: "missing_heartbeat" }),
            ])
        );
    });

    it("STOP updates active session status", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.syncSession.findFirst as jest.Mock).mockResolvedValue({
            id: "session-1",
            userId: "user-1",
            status: "RUNNING",
            devices: [{ id: "ssd-1", status: "PLAYING" }],
        });

        const tx = {
            syncSession: {
                update: jest.fn().mockResolvedValue({}),
                findUnique: jest.fn().mockResolvedValue({
                    id: "session-1",
                    status: "STOPPED",
                }),
            },
            syncSessionDevice: {
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            syncDeviceCommand: {
                createMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        };

        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));

        const request = new Request("http://localhost/api/sync/session/stop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: "session-1", reason: "USER_STOP" }),
        });

        const response = await STOP_SYNC(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.stopReason).toBe("USER_STOP");
        expect(tx.syncSession.update).toHaveBeenCalled();
        expect(tx.syncSessionDevice.updateMany).toHaveBeenCalled();
    });

    it("STOP is idempotent for already stopped sessions", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.syncSession.findFirst as jest.Mock).mockResolvedValue({
            id: "session-1",
            status: "STOPPED",
            devices: [],
        });

        const request = new Request("http://localhost/api/sync/session/stop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: "session-1" }),
        });

        const response = await STOP_SYNC(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.alreadyStopped).toBe(true);
    });

    it("ACTIVE returns latest active session", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.syncSession.findFirst as jest.Mock).mockResolvedValue({
            id: "session-1",
            status: "RUNNING",
            startAtMs: BigInt(1739650000000),
        });

        const response = await GET_ACTIVE_SYNC();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.session.id).toBe("session-1");
        expect(typeof body.session.startAtMs).toBe("number");
    });
});
