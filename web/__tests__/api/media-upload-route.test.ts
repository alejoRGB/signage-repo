/**
 * @jest-environment node
 */
import { POST } from "@/app/api/media/upload/route";
import { handleUpload } from "@vercel/blob/client";
import { del, head } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { MAX_MEDIA_UPLOAD_SIZE_BYTES } from "@/lib/media-upload-policy";

jest.mock("@vercel/blob/client", () => ({
    handleUpload: jest.fn(),
}));

jest.mock("@vercel/blob", () => ({
    head: jest.fn(),
    del: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
        },
        mediaItem: {
            aggregate: jest.fn(),
            findFirst: jest.fn(),
        },
    },
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
    authOptions: {},
}));

describe("POST /api/media/upload", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        (prisma.mediaItem.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 0 } });
        (prisma.mediaItem.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1", isActive: true });
        (head as jest.Mock).mockResolvedValue({
            url: "https://blob.example.com/f.mp4",
            pathname: "media/test.mp4",
            contentType: "video/mp4",
            contentDisposition: "inline",
            size: 1024,
            uploadedAt: new Date(),
            downloadUrl: "https://blob.example.com/f.mp4?download=1",
        });
        (del as jest.Mock).mockResolvedValue(undefined);
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("generates client upload token with 2 GB max size", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user-1" } });

        (handleUpload as jest.Mock).mockImplementation(async ({ onBeforeGenerateToken }) => {
            const tokenConfig = await onBeforeGenerateToken(
                "media/test.mp4",
                JSON.stringify({ size: 1234, contentType: "video/mp4", originalName: "test.mp4" }),
                false
            );
            expect(tokenConfig.maximumSizeInBytes).toBe(MAX_MEDIA_UPLOAD_SIZE_BYTES);
            expect(tokenConfig.allowedContentTypes).toEqual(
                expect.arrayContaining(["video/mp4", "image/png"])
            );
            expect(tokenConfig.tokenPayload).toContain("\"userId\":\"user-1\"");
            expect(tokenConfig.tokenPayload).toContain("\"declaredSize\":1234");

            return {
                type: "blob.generate-client-token",
                clientToken: "token-123",
            };
        });

        const res = await POST(
            new Request("http://localhost/api/media/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "blob.generate-client-token" }),
            })
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.clientToken).toBe("token-123");
    });

    it("returns 400 when unauthenticated upload token generation is requested", async () => {
        (getServerSession as jest.Mock).mockResolvedValue(null);

        (handleUpload as jest.Mock).mockImplementation(async ({ onBeforeGenerateToken }) => {
            await onBeforeGenerateToken("media/test.mp4", null, false);
            return { type: "blob.generate-client-token", clientToken: "unreachable" };
        });

        const res = await POST(
            new Request("http://localhost/api/media/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "blob.generate-client-token" }),
            })
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toMatch(/unauthorized/i);
    });

    it("returns 400 when projected user quota is exceeded during token generation", async () => {
        process.env.MEDIA_UPLOAD_USER_QUOTA_BYTES = String(MAX_MEDIA_UPLOAD_SIZE_BYTES);
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user-1" } });
        (prisma.mediaItem.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: MAX_MEDIA_UPLOAD_SIZE_BYTES - 200 } });

        (handleUpload as jest.Mock).mockImplementation(async ({ onBeforeGenerateToken }) => {
            await onBeforeGenerateToken(
                "media/test.mp4",
                JSON.stringify({ size: 500, contentType: "video/mp4" }),
                false
            );
            return { type: "blob.generate-client-token", clientToken: "unreachable" };
        });

        const res = await POST(
            new Request("http://localhost/api/media/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "blob.generate-client-token" }),
            })
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toMatch(/quota/i);
    });

    it("verifies upload completion callback and deletes blob when owner is inactive", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user-1" } });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1", isActive: false });

        (handleUpload as jest.Mock).mockImplementation(async ({ onUploadCompleted }) => {
            await onUploadCompleted({
                blob: {
                    url: "https://public.blob.vercel-storage.com/media/test.mp4",
                    pathname: "media/test.mp4",
                    contentType: "video/mp4",
                    contentDisposition: "inline",
                    downloadUrl: "https://public.blob.vercel-storage.com/media/test.mp4?download=1",
                },
                tokenPayload: JSON.stringify({ userId: "user-1", pathname: "media/test.mp4" }),
            });
            return { type: "blob.upload-completed" };
        });

        const res = await POST(
            new Request("http://localhost/api/media/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "blob.upload-completed" }),
            })
        );
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toMatch(/inactive upload owner/i);
        expect(del).toHaveBeenCalledWith("https://public.blob.vercel-storage.com/media/test.mp4");
    });
});
