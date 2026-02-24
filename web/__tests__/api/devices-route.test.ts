/**
 * @jest-environment node
 */
import { GET as GET_DEVICES } from "@/app/api/devices/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
    authOptions: {},
}));

jest.mock("@/lib/prisma", () => ({
    prisma: {
        device: {
            findMany: jest.fn(),
        },
        mediaItem: {
            findMany: jest.fn(),
        },
    },
}));

describe("GET /api/devices", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns 401 when unauthenticated", async () => {
        (getServerSession as jest.Mock).mockResolvedValue(null);

        const response = await GET_DEVICES(new Request("http://localhost/api/devices"));
        expect(response.status).toBe(401);
    });

    it("does not expose token and avoids media query when no current content names", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.device.findMany as jest.Mock).mockResolvedValue([
            {
                id: "device-1",
                name: "Lobby",
                status: "online",
                activePlaylistId: null,
                defaultPlaylistId: null,
                scheduleId: null,
                playingPlaylistId: null,
                currentContentName: null,
                previewImageUrl: null,
                previewCapturedAt: null,
                cpuTemp: null,
                cpuTempUpdatedAt: null,
                createdAt: new Date("2026-02-24T10:00:00.000Z"),
                updatedAt: new Date("2026-02-24T10:00:00.000Z"),
                lastSeenAt: new Date("2026-02-24T10:00:00.000Z"),
                activePlaylist: null,
                schedule: null,
                playingPlaylist: null,
                syncSessionDevices: [],
                token: "should-not-be-selected",
            },
        ]);
        (prisma.mediaItem.findMany as jest.Mock).mockResolvedValue([]);

        const response = await GET_DEVICES(new Request("http://localhost/api/devices"));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0]).not.toHaveProperty("token");
        const deviceFindManyArgs = (prisma.device.findMany as jest.Mock).mock.calls[0]?.[0];
        expect(deviceFindManyArgs.select).toBeDefined();
        expect(deviceFindManyArgs.select.token).toBeUndefined();
        expect(deviceFindManyArgs.select.userId).toBeUndefined();
        expect(prisma.mediaItem.findMany).not.toHaveBeenCalled();
    });

    it("queries media only for referenced current content names", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.device.findMany as jest.Mock).mockResolvedValue([
            {
                id: "device-1",
                name: "Lobby",
                status: "online",
                activePlaylistId: null,
                defaultPlaylistId: null,
                scheduleId: null,
                playingPlaylistId: null,
                currentContentName: "video.mp4",
                previewImageUrl: null,
                previewCapturedAt: null,
                cpuTemp: null,
                cpuTempUpdatedAt: null,
                createdAt: new Date("2026-02-24T10:00:00.000Z"),
                updatedAt: new Date("2026-02-24T10:00:00.000Z"),
                lastSeenAt: new Date("2026-02-24T10:00:00.000Z"),
                activePlaylist: null,
                schedule: null,
                playingPlaylist: null,
                syncSessionDevices: [],
            },
            {
                id: "device-2",
                name: "Window",
                status: "online",
                activePlaylistId: null,
                defaultPlaylistId: null,
                scheduleId: null,
                playingPlaylistId: null,
                currentContentName: " Banner Promo ",
                previewImageUrl: null,
                previewCapturedAt: null,
                cpuTemp: null,
                cpuTempUpdatedAt: null,
                createdAt: new Date("2026-02-24T10:00:00.000Z"),
                updatedAt: new Date("2026-02-24T10:00:00.000Z"),
                lastSeenAt: new Date("2026-02-24T10:00:00.000Z"),
                activePlaylist: null,
                schedule: null,
                playingPlaylist: null,
                syncSessionDevices: [],
            },
        ]);
        (prisma.mediaItem.findMany as jest.Mock).mockResolvedValue([
            {
                name: "Banner Promo",
                filename: "video.mp4",
                type: "video",
                url: "/uploads/video.mp4",
            },
        ]);

        const response = await GET_DEVICES(new Request("http://localhost/api/devices"));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(prisma.mediaItem.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: "user-1",
                    OR: expect.arrayContaining([
                        { name: { in: ["video.mp4", "Banner Promo"] } },
                        { filename: { in: ["video.mp4", "Banner Promo"] } },
                    ]),
                }),
            })
        );
        expect(body[0].contentPreview).toEqual(
            expect.objectContaining({
                url: "/uploads/video.mp4",
            })
        );
    });
});
