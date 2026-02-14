/**
 * @jest-environment node
 */
import { POST } from "@/app/api/media/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        mediaItem: {
            create: jest.fn(),
        },
    },
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
    authOptions: {},
}));

describe("POST /api/media", () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
});
