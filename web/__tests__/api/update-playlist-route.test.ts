/**
 * @jest-environment node
 */
import { PUT } from "@/app/api/playlists/[id]/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        playlist: {
            findUnique: jest.fn(),
        },
        mediaItem: {
            findMany: jest.fn(),
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

describe("PUT /api/playlists/[id]", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.playlist.findUnique as jest.Mock).mockResolvedValue({
            id: "playlist-1",
            userId: "user-1",
            type: "media",
        });
    });

    it("rejects media items that are not owned by the playlist owner", async () => {
        // Simulate that no requested media IDs belong to user-1.
        (prisma.mediaItem.findMany as jest.Mock).mockResolvedValue([]);

        const response = await PUT(
            new Request("http://localhost/api/playlists/playlist-1", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Updated",
                    items: [{ mediaItemId: "media-owned-by-user-2", duration: 10 }],
                }),
            }),
            { params: Promise.resolve({ id: "playlist-1" }) }
        );

        const body = await response.json();
        expect(response.status).toBe(403);
        expect(body.error).toMatch(/unauthorized/i);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.mediaItem.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: "user-1",
                    id: { in: ["media-owned-by-user-2"] },
                }),
            })
        );
    });

    it("allows updates when all media items belong to the owner", async () => {
        (prisma.mediaItem.findMany as jest.Mock).mockResolvedValue([
            { id: "media-1", type: "video" },
            { id: "media-2", type: "image" },
        ]);

        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
            const tx = {
                playlist: { update: jest.fn().mockResolvedValue({}) },
                playlistItem: {
                    deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
                    createMany: jest.fn().mockResolvedValue({ count: 2 }),
                },
            };
            await callback(tx);
        });

        const response = await PUT(
            new Request("http://localhost/api/playlists/playlist-1", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Updated",
                    orientation: "landscape",
                    items: [
                        { mediaItemId: "media-1", duration: 12 },
                        { mediaItemId: "media-2", duration: 10 },
                    ],
                }),
            }),
            { params: Promise.resolve({ id: "playlist-1" }) }
        );

        expect(response.status).toBe(200);
        expect(prisma.$transaction).toHaveBeenCalled();
    });
});

