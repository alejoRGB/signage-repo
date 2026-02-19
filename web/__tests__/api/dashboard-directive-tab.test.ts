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
        syncSession: {
            findMany: jest.fn(),
            updateMany: jest.fn(),
        },
        syncSessionDevice: {
            updateMany: jest.fn(),
        },
        syncDeviceCommand: {
            createMany: jest.fn(),
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

describe("Dashboard directive tab API", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.syncSession.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.syncSession.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
        (prisma.syncSessionDevice.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
        (prisma.syncDeviceCommand.createMany as jest.Mock).mockResolvedValue({ count: 0 });
        (prisma.$transaction as jest.Mock).mockResolvedValue([]);
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
        expect(prisma.syncSession.findMany).not.toHaveBeenCalled();
        expect(body.activeDirectiveTab).toBe("SYNC_VIDEOWALL");
    });

    it("PATCH to SCHEDULES stops active sync sessions", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.user.update as jest.Mock).mockResolvedValue({
            activeDirectiveTab: "SCHEDULES",
        });
        (prisma.syncSession.findMany as jest.Mock).mockResolvedValue([
            {
                id: "session-1",
                devices: [{ deviceId: "device-1" }, { deviceId: "device-2" }],
            },
        ]);

        const request = new Request("http://localhost/api/dashboard/directive-tab", {
            method: "PATCH",
            body: JSON.stringify({ activeDirectiveTab: "SCHEDULES" }),
            headers: { "Content-Type": "application/json" },
        });

        const response = await PATCH(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(prisma.syncSession.findMany).toHaveBeenCalled();
        expect(prisma.syncSession.updateMany).toHaveBeenCalled();
        expect(prisma.syncSessionDevice.updateMany).toHaveBeenCalled();
        expect(prisma.syncDeviceCommand.createMany).toHaveBeenCalled();
        expect(prisma.$transaction).toHaveBeenCalled();
        expect(body.activeDirectiveTab).toBe("SCHEDULES");
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
