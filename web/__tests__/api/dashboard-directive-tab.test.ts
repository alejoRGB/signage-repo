/**
 * @jest-environment node
 */
import { GET, PATCH } from "@/app/api/dashboard/directive-tab/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    },
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
    authOptions: {},
}));

describe("Dashboard directive tab API", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("GET returns 401 when user is not authenticated", async () => {
        (getServerSession as jest.Mock).mockResolvedValue(null);

        const response = await GET();
        expect(response.status).toBe(401);
    });

    it("GET returns active tab for authenticated USER", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({
            activeDirectiveTab: "SYNC_VIDEOWALL",
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.activeDirectiveTab).toBe("SYNC_VIDEOWALL");
    });

    it("PATCH returns 403 for non-USER role", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "admin-1", role: "ADMIN" },
        });

        const request = new Request("http://localhost/api/dashboard/directive-tab", {
            method: "PATCH",
            body: JSON.stringify({ activeDirectiveTab: "SCHEDULES" }),
            headers: { "Content-Type": "application/json" },
        });

        const response = await PATCH(request);
        expect(response.status).toBe(403);
    });

    it("PATCH validates payload and persists active tab", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.user.update as jest.Mock).mockResolvedValue({
            activeDirectiveTab: "SYNC_VIDEOWALL",
        });

        const request = new Request("http://localhost/api/dashboard/directive-tab", {
            method: "PATCH",
            body: JSON.stringify({ activeDirectiveTab: "SYNC_VIDEOWALL" }),
            headers: { "Content-Type": "application/json" },
        });

        const response = await PATCH(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user-1" },
            data: { activeDirectiveTab: "SYNC_VIDEOWALL" },
            select: { activeDirectiveTab: true },
        });
        expect(body.activeDirectiveTab).toBe("SYNC_VIDEOWALL");
    });

    it("PATCH returns 400 on invalid tab value", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });

        const request = new Request("http://localhost/api/dashboard/directive-tab", {
            method: "PATCH",
            body: JSON.stringify({ activeDirectiveTab: "INVALID" }),
            headers: { "Content-Type": "application/json" },
        });

        const response = await PATCH(request);
        expect(response.status).toBe(400);
        expect(prisma.user.update).not.toHaveBeenCalled();
    });
});
