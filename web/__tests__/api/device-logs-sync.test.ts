/**
 * @jest-environment node
 */
import { POST as POST_DEVICE_LOGS } from "@/app/api/device/logs/route";
import { GET as GET_DEVICE_LOGS } from "@/app/api/devices/[id]/logs/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        device: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
        },
        deviceLog: {
            createMany: jest.fn(),
            deleteMany: jest.fn(),
            findMany: jest.fn(),
        },
    },
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
    authOptions: {},
}));

jest.mock("@/lib/rate-limit", () => ({
    checkRateLimit: jest.fn(async () => true),
}));

describe("SYNC-040 device logs API", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.device.findUnique as jest.Mock).mockResolvedValue({
            id: "device-1",
            token: "token-1",
        });
        (prisma.deviceLog.createMany as jest.Mock).mockResolvedValue({ count: 1 });
        (prisma.deviceLog.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    });

    it("POST persists structured sync logs", async () => {
        const response = await POST_DEVICE_LOGS(
            new Request("http://localhost/api/device/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device_token: "token-1",
                    logs: [
                        {
                            level: "info",
                            message: "sync ready",
                            event: "READY",
                            session_id: "session-1",
                            data: { warmup: 3 },
                            timestamp: "2026-02-16T00:00:00.000Z",
                        },
                    ],
                }),
            })
        );

        expect(response.status).toBe(200);
        expect(prisma.deviceLog.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: [
                    expect.objectContaining({
                        deviceId: "device-1",
                        event: "READY",
                        sessionId: "session-1",
                        data: { warmup: 3 },
                    }),
                ],
            })
        );
    });

    it("POST rejects unknown sync event", async () => {
        const response = await POST_DEVICE_LOGS(
            new Request("http://localhost/api/device/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device_token: "token-1",
                    logs: [
                        {
                            level: "info",
                            event: "NOT_A_REAL_EVENT",
                        },
                    ],
                }),
            })
        );

        expect(response.status).toBe(400);
        expect(prisma.deviceLog.createMany).not.toHaveBeenCalled();
    });

    it("GET filters logs by sessionId and event", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.device.findFirst as jest.Mock).mockResolvedValue({
            id: "device-1",
            userId: "user-1",
        });
        (prisma.deviceLog.findMany as jest.Mock).mockResolvedValue([
            {
                id: "log-1",
                level: "info",
                message: "[SYNC_EVENT] READY",
                event: "READY",
                sessionId: "session-1",
                data: { warmup: 3 },
                createdAt: new Date("2026-02-16T00:00:00.000Z"),
            },
        ]);

        const response = await GET_DEVICE_LOGS(
            new Request("http://localhost/api/devices/device-1/logs?sessionId=session-1&event=READY&limit=20"),
            { params: Promise.resolve({ id: "device-1" }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(prisma.deviceLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    deviceId: "device-1",
                    sessionId: "session-1",
                    event: "READY",
                }),
                take: 20,
            })
        );
        expect(body.events[0]).toEqual(
            expect.objectContaining({
                id: "log-1",
                event: "READY",
                sessionId: "session-1",
            })
        );
    });
});
