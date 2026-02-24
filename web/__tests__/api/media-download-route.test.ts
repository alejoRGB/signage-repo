/**
 * @jest-environment node
 */
import { GET } from "@/app/api/media/download/[id]/route";
import { prisma } from "@/lib/prisma";
import fs from "fs";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        device: {
            findUnique: jest.fn(),
        },
        mediaItem: {
            findFirst: jest.fn(),
        },
    },
}));

jest.mock("fs", () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
}));

describe("GET /api/media/download/[id]", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.device.findUnique as jest.Mock).mockResolvedValue({
            id: "device-1",
            userId: "user-1",
        });
    });

    it("rejects unsafe stored filenames", async () => {
        (prisma.mediaItem.findFirst as jest.Mock).mockResolvedValue({
            id: "media-1",
            userId: "user-1",
            url: "/uploads/x.mp4",
            filename: "../escape.mp4",
        });

        const response = await GET(
            new Request("http://localhost/api/media/download/media-1", {
                headers: { "X-Device-Token": "token-1" },
            }),
            { params: Promise.resolve({ id: "media-1" }) }
        );

        expect(response.status).toBe(400);
        expect(fs.existsSync).not.toHaveBeenCalled();
        expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it("does not redirect non-http(s) URLs", async () => {
        (prisma.mediaItem.findFirst as jest.Mock).mockResolvedValue({
            id: "media-1",
            userId: "user-1",
            url: "file:///etc/passwd",
            filename: null,
        });

        const response = await GET(
            new Request("http://localhost/api/media/download/media-1", {
                headers: { "X-Device-Token": "token-1" },
            }),
            { params: Promise.resolve({ id: "media-1" }) }
        );

        expect(response.status).toBe(404);
        expect(response.headers.get("location")).toBeNull();
    });

    it("redirects https media URLs", async () => {
        (prisma.mediaItem.findFirst as jest.Mock).mockResolvedValue({
            id: "media-1",
            userId: "user-1",
            url: "https://cdn.example.com/video.mp4",
            filename: "video.mp4",
        });

        const response = await GET(
            new Request("http://localhost/api/media/download/media-1", {
                headers: { "X-Device-Token": "token-1" },
            }),
            { params: Promise.resolve({ id: "media-1" }) }
        );

        expect(response.status).toBeGreaterThanOrEqual(300);
        expect(response.status).toBeLessThan(400);
        expect(response.headers.get("location")).toBe("https://cdn.example.com/video.mp4");
    });

    it("rejects legacy token query param fallback", async () => {
        (prisma.mediaItem.findFirst as jest.Mock).mockResolvedValue({
            id: "media-1",
            userId: "user-1",
            url: "https://cdn.example.com/video.mp4",
            filename: "video.mp4",
        });

        const response = await GET(
            new Request("http://localhost/api/media/download/media-1?token=legacy-token"),
            { params: Promise.resolve({ id: "media-1" }) }
        );

        const body = await response.json();
        expect(prisma.device.findUnique).not.toHaveBeenCalled();
        expect(response.status).toBe(401);
        expect(body.error).toBe("Device token required");
    });
});
