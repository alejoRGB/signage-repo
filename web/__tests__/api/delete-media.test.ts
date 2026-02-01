/**
 * @jest-environment node
 */
import { DELETE } from "@/app/api/media/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { del } from "@vercel/blob";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
    prisma: {
        mediaItem: {
            findUnique: jest.fn(),
            delete: jest.fn(),
        },
        playlistItem: {
            deleteMany: jest.fn(),
        },
    },
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
    authOptions: {},
}));

jest.mock("@vercel/blob", () => ({
    del: jest.fn(),
}));

jest.mock("fs/promises", () => ({
    unlink: jest.fn(),
}));

describe("DELETE /api/media", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return 401 if not authenticated", async () => {
        (getServerSession as jest.Mock).mockResolvedValue(null);
        const req = new Request("http://localhost/api/media?id=123");
        const res = await DELETE(req);
        expect(res.status).toBe(401);
    });

    it("should return 404 if media not found", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user1" } });
        (prisma.mediaItem.findUnique as jest.Mock).mockResolvedValue(null);

        const req = new Request("http://localhost/api/media?id=123");
        const res = await DELETE(req);
        expect(res.status).toBe(404);
    });

    it("should delete media from DB and Blob", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user1" } });
        (prisma.mediaItem.findUnique as jest.Mock).mockResolvedValue({
            id: "media1",
            userId: "user1",
            url: "https://public.blob.vercel-storage.com/file.mp4",
            filename: "file.mp4"
        });

        const req = new Request("http://localhost/api/media?id=media1");
        const res = await DELETE(req);

        expect(prisma.playlistItem.deleteMany).toHaveBeenCalledWith({ where: { mediaItemId: "media1" } });
        expect(prisma.mediaItem.delete).toHaveBeenCalledWith({ where: { id: "media1" } });
        expect(del).toHaveBeenCalledWith("https://public.blob.vercel-storage.com/file.mp4");
        expect(res.status).toBe(200);
    });
});
