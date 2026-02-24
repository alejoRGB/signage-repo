/**
 * @jest-environment node
 */
import { POST } from "@/app/api/media/upload/route";
import { handleUpload } from "@vercel/blob/client";
import { getServerSession } from "next-auth";
import { MAX_MEDIA_UPLOAD_SIZE_BYTES } from "@/lib/media-upload-policy";

jest.mock("@vercel/blob/client", () => ({
    handleUpload: jest.fn(),
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
    authOptions: {},
}));

describe("POST /api/media/upload", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("generates client upload token with 2 GB max size", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user-1" } });

        (handleUpload as jest.Mock).mockImplementation(async ({ onBeforeGenerateToken }) => {
            const tokenConfig = await onBeforeGenerateToken("media/test.mp4", null, false);
            expect(tokenConfig.maximumSizeInBytes).toBe(MAX_MEDIA_UPLOAD_SIZE_BYTES);
            expect(tokenConfig.allowedContentTypes).toEqual(
                expect.arrayContaining(["video/mp4", "image/png"])
            );
            expect(tokenConfig.tokenPayload).toContain("\"userId\":\"user-1\"");

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
});

