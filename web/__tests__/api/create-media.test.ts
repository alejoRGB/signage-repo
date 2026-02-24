/**
 * @jest-environment node
 */
import { POST } from "@/app/api/media/route";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        mediaItem: {
            create: jest.fn(),
            aggregate: jest.fn(),
        },
    },
}));

jest.mock("@vercel/blob", () => ({
    del: jest.fn(),
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
    authOptions: {},
}));

describe("POST /api/media", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        (prisma.mediaItem.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });
        (del as jest.Mock).mockResolvedValue(undefined);
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("returns 401 when unauthenticated", async () => {
        (getServerSession as jest.Mock).mockResolvedValue(null);

        const req = new Request("http://localhost/api/media", {
            method: "POST",
            body: JSON.stringify({}),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 for invalid payload", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user1" } });

        const req = new Request("http://localhost/api/media", {
            method: "POST",
            body: JSON.stringify({
                name: "Broken item",
                type: "web",
                // url intentionally invalid/missing to trigger schema validation
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
        expect(prisma.mediaItem.create).not.toHaveBeenCalled();
    });

    it("returns 400 for non-http URL schemes", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user1" } });

        const req = new Request("http://localhost/api/media", {
            method: "POST",
            body: JSON.stringify({
                name: "Bad URL",
                url: "file:///etc/passwd",
                type: "image",
                filename: "photo.jpg",
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
        expect(prisma.mediaItem.create).not.toHaveBeenCalled();
    });

    it("returns 400 for unsafe filename", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user1" } });

        const req = new Request("http://localhost/api/media", {
            method: "POST",
            body: JSON.stringify({
                name: "Bad filename",
                url: "https://example.com/video.mp4",
                type: "video",
                filename: "../video.mp4",
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
        expect(prisma.mediaItem.create).not.toHaveBeenCalled();
    });

    it("returns 400 when file size exceeds 2 GB", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user1" } });

        const req = new Request("http://localhost/api/media", {
            method: "POST",
            body: JSON.stringify({
                name: "Huge Video",
                url: "https://example.com/huge.mp4",
                type: "video",
                filename: "huge.mp4",
                size: 2 * 1024 * 1024 * 1024 + 1,
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toMatch(/2 gb/i);
        expect(prisma.mediaItem.create).not.toHaveBeenCalled();
    });

    it("persists valid web item", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user1" } });
        (prisma.mediaItem.create as jest.Mock).mockResolvedValue({
            id: "media1",
            name: "Web Item",
            type: "web",
        });

        const req = new Request("http://localhost/api/media", {
            method: "POST",
            body: JSON.stringify({
                name: "Web Item",
                url: "https://example.com",
                type: "web",
                duration: 15,
                cacheForOffline: true,
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(prisma.mediaItem.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                name: "Web Item",
                url: "https://example.com",
                type: "web",
                filename: null,
                duration: 15,
                cacheForOffline: true,
                userId: "user1",
            }),
        });
    });

    it("returns 409 when user media quota is exceeded and cleans up uploaded blob", async () => {
        process.env.MEDIA_UPLOAD_USER_QUOTA_BYTES = String(2 * 1024 * 1024 * 1024);
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user1" } });
        (prisma.mediaItem.aggregate as jest.Mock).mockResolvedValue({
            _sum: { size: 2 * 1024 * 1024 * 1024 - 100 },
        });

        const req = new Request("http://localhost/api/media", {
            method: "POST",
            body: JSON.stringify({
                name: "Blob Video",
                url: "https://public.blob.vercel-storage.com/uploads/blob-video.mp4",
                type: "video",
                filename: "blob-video.mp4",
                size: 200,
                duration: 10,
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.error).toMatch(/quota/i);
        expect(prisma.mediaItem.create).not.toHaveBeenCalled();
        expect(del).toHaveBeenCalledWith("https://public.blob.vercel-storage.com/uploads/blob-video.mp4");
    });

    it("persists durationMs for valid video item", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user1" } });
        (prisma.mediaItem.create as jest.Mock).mockResolvedValue({
            id: "media-video-1",
            name: "Video Item",
            type: "video",
            durationMs: 12500,
        });

        const req = new Request("http://localhost/api/media", {
            method: "POST",
            body: JSON.stringify({
                name: "Video Item",
                url: "https://example.com/video.mp4",
                type: "video",
                filename: "video.mp4",
                duration: 13,
                durationMs: 12500,
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(prisma.mediaItem.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "video",
                duration: 13,
                durationMs: 12500,
                userId: "user1",
            }),
        });
    });
});
