/**
 * @jest-environment node
 */
import { POST as HEARTBEAT_POST } from "@/app/api/device/heartbeat/route";
import { POST as DEVICE_SYNC_POST } from "@/app/api/device/sync/route";
import { prisma } from "@/lib/prisma";
import {
    extractSyncRuntimeFromFormData,
    extractSyncRuntimeFromJson,
    persistDeviceSyncRuntime,
} from "@/lib/sync-runtime-service";
import { maybeReelectMasterForSession } from "@/lib/sync-master-election";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        device: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    },
}));

jest.mock("@/lib/rate-limit", () => ({
    checkRateLimit: jest.fn(async () => true),
}));

jest.mock("@/lib/sync-runtime-service", () => ({
    extractSyncRuntimeFromFormData: jest.fn(),
    extractSyncRuntimeFromJson: jest.fn(),
    persistDeviceSyncRuntime: jest.fn(),
}));

jest.mock("@/lib/sync-master-election", () => ({
    maybeReelectMasterForSession: jest.fn(),
}));

describe("Device runtime sync persistence", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.device.findUnique as jest.Mock).mockResolvedValue({
            id: "device-1",
            token: "token-1",
            user: { isActive: true },
        });
        (prisma.device.update as jest.Mock).mockResolvedValue({ id: "device-1" });
    });

    it("heartbeat persists extracted sync runtime", async () => {
        (extractSyncRuntimeFromFormData as jest.Mock).mockReturnValue({
            sessionId: "session-1",
            status: "READY",
            driftMs: 5,
        });

        const formData = new FormData();
        formData.set("device_token", "token-1");
        formData.set("sync_session_id", "session-1");

        const response = await HEARTBEAT_POST(
            new Request("http://localhost/api/device/heartbeat", {
                method: "POST",
                body: formData,
            })
        );

        expect(response.status).toBe(200);
        expect(extractSyncRuntimeFromFormData).toHaveBeenCalled();
        expect(persistDeviceSyncRuntime).toHaveBeenCalledWith(
            "device-1",
            expect.objectContaining({
                sessionId: "session-1",
            })
        );
        expect(maybeReelectMasterForSession).toHaveBeenCalledWith("session-1");
    });

    it("throttles master reelection checks to once per 10 seconds per session", async () => {
        (extractSyncRuntimeFromFormData as jest.Mock).mockReturnValue({
            sessionId: "session-throttle",
            status: "PLAYING",
            driftMs: 3,
        });

        const nowSpy = jest.spyOn(Date, "now");
        nowSpy
            .mockReturnValueOnce(1_000)
            .mockReturnValueOnce(5_000)
            .mockReturnValueOnce(12_001);

        try {
            const buildRequest = () => {
                const formData = new FormData();
                formData.set("device_token", "token-1");
                formData.set("sync_session_id", "session-throttle");
                return new Request("http://localhost/api/device/heartbeat", {
                    method: "POST",
                    body: formData,
                });
            };

            const response1 = await HEARTBEAT_POST(buildRequest());
            const response2 = await HEARTBEAT_POST(buildRequest());
            const response3 = await HEARTBEAT_POST(buildRequest());

            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
            expect(response3.status).toBe(200);
            expect(maybeReelectMasterForSession).toHaveBeenCalledTimes(2);
            expect(maybeReelectMasterForSession).toHaveBeenNthCalledWith(1, "session-throttle");
            expect(maybeReelectMasterForSession).toHaveBeenNthCalledWith(2, "session-throttle");
        } finally {
            nowSpy.mockRestore();
        }
    });

    it("device sync route persists extracted runtime payload", async () => {
        (extractSyncRuntimeFromJson as jest.Mock).mockReturnValue({
            sessionId: "session-1",
            status: "PLAYING",
            driftMs: 2,
        });

        const response = await DEVICE_SYNC_POST(
            new Request("http://localhost/api/device/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device_token: "token-1",
                    sync_runtime: {
                        session_id: "session-1",
                        status: "PLAYING",
                    },
                }),
            })
        );

        expect(response.status).toBe(200);
        expect(extractSyncRuntimeFromJson).toHaveBeenCalled();
        expect(persistDeviceSyncRuntime).toHaveBeenCalledWith(
            "device-1",
            expect.objectContaining({
                sessionId: "session-1",
            })
        );
    });

    it("device sync route suppresses schedule/default payload when Sync tab is active", async () => {
        (extractSyncRuntimeFromJson as jest.Mock).mockReturnValue(null);

        (prisma.device.findUnique as jest.Mock).mockResolvedValue({
            id: "device-1",
            token: "token-1",
            name: "Device 1",
            user: { isActive: true, activeDirectiveTab: "SYNC_VIDEOWALL" },
            schedule: {
                id: "schedule-1",
                name: "Schedule",
                items: [
                    {
                        dayOfWeek: 1,
                        startTime: "09:00",
                        endTime: "10:00",
                        playlist: {
                            id: "playlist-schedule",
                            name: "Schedule Playlist",
                            orientation: "landscape",
                            items: [
                                {
                                    id: "pi-1",
                                    order: 1,
                                    duration: 10,
                                    mediaItem: {
                                        id: "m-1",
                                        type: "image",
                                        url: "https://cdn.example.com/m-1.jpg",
                                        name: "Image",
                                        filename: "m-1.jpg",
                                        duration: null,
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
            defaultPlaylist: {
                id: "playlist-default",
                name: "Default Playlist",
                orientation: "landscape",
                items: [
                    {
                        id: "pi-2",
                        order: 1,
                        duration: 10,
                        mediaItem: {
                            id: "m-2",
                            type: "image",
                            url: "https://cdn.example.com/m-2.jpg",
                            name: "Image 2",
                            filename: "m-2.jpg",
                            duration: null,
                        },
                    },
                ],
            },
            activePlaylist: null,
        });

        const response = await DEVICE_SYNC_POST(
            new Request("http://localhost/api/device/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ device_token: "token-1" }),
            })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.playlist).toBeNull();
        expect(body.schedule).toBeNull();
        expect(body.default_playlist).toBeNull();
    });

    it("device sync route uses request origin when NEXT_PUBLIC_APP_URL is missing", async () => {
        (extractSyncRuntimeFromJson as jest.Mock).mockReturnValue(null);

        const previousBaseUrl = process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.NEXT_PUBLIC_APP_URL;

        (prisma.device.findUnique as jest.Mock).mockResolvedValue({
            id: "device-1",
            token: "token-1",
            name: "Device 1",
            user: { isActive: true, activeDirectiveTab: "SCHEDULES" },
            schedule: null,
            defaultPlaylist: null,
            activePlaylist: {
                id: "playlist-default",
                name: "Default Playlist",
                orientation: "landscape",
                items: [
                    {
                        id: "pi-2",
                        order: 1,
                        duration: 10,
                        mediaItem: {
                            id: "m-2",
                            type: "image",
                            url: "/media/m-2.jpg",
                            name: "Image 2",
                            filename: "m-2.jpg",
                            duration: null,
                        },
                    },
                ],
            },
        });

        try {
            const response = await DEVICE_SYNC_POST(
                new Request("https://senaldigital.xyz/api/device/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ device_token: "token-1" }),
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.playlist.items[0].url).toBe(
                "https://senaldigital.xyz/api/media/download/m-2?token=token-1"
            );
        } finally {
            if (typeof previousBaseUrl === "string") {
                process.env.NEXT_PUBLIC_APP_URL = previousBaseUrl;
            } else {
                delete process.env.NEXT_PUBLIC_APP_URL;
            }
        }
    });
});
