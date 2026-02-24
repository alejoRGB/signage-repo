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
            user: { isActive: true },
        });
        (prisma.deviceLog.createMany as jest.Mock).mockResolvedValue({ count: 1 });
        (prisma.deviceLog.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    });

    it("POST persists structured sync logs and returns contract versions", async () => {
        const response = await POST_DEVICE_LOGS(
            new Request("http://localhost/api/device/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device_token: "token-1",
                    schema_version: 1,
                    sync_event_contract_version: 1,
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
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.accepted_log_schema_version).toBe(1);
        expect(body.accepted_sync_event_contract_version).toBe(1);
        expect(prisma.deviceLog.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: [
                    expect.objectContaining({
                        deviceId: "device-1",
                        event: "READY",
                        sessionId: "session-1",
                        data: expect.objectContaining({
                            warmup: 3,
                            client_log_schema_version: 1,
                            client_sync_event_contract_version: 1,
                        }),
                    }),
                ],
            })
        );
    });

    it("POST preserves unknown sync event as raw_event without rejecting the batch", async () => {
        const response = await POST_DEVICE_LOGS(
            new Request("http://localhost/api/device/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device_token: "token-1",
                    schema_version: 99,
                    sync_event_contract_version: 7,
                    logs: [
                        {
                            level: "info",
                            event: "NOT_A_REAL_EVENT",
                        },
                    ],
                }),
            })
        );

        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.ignored_unknown_events).toBe(1);
        expect(body.accepted_log_schema_version).toBe(1);
        expect(body.accepted_sync_event_contract_version).toBe(1);
        expect(prisma.deviceLog.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: [
                    expect.objectContaining({
                        event: null,
                        data: expect.objectContaining({
                            raw_event: "NOT_A_REAL_EVENT",
                            unknown_event: true,
                            client_log_schema_version: 99,
                            client_sync_event_contract_version: 7,
                            server_log_schema_version: 1,
                            server_sync_event_contract_version: 1,
                        }),
                    }),
                ],
            })
        );
    });

    it("POST rejects suspended device account", async () => {
        (prisma.device.findUnique as jest.Mock).mockResolvedValue({
            id: "device-1",
            token: "token-1",
            user: { isActive: false },
        });

        const response = await POST_DEVICE_LOGS(
            new Request("http://localhost/api/device/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device_token: "token-1",
                    logs: [{ level: "info", message: "x" }],
                }),
            })
        );

        expect(response.status).toBe(403);
        expect(prisma.deviceLog.createMany).not.toHaveBeenCalled();
    });

    it("POST stores server createdAt and preserves client timestamp in data", async () => {
        const before = Date.now();
        const response = await POST_DEVICE_LOGS(
            new Request("http://localhost/api/device/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device_token: "token-1",
                    logs: [
                        {
                            level: "info",
                            message: "line1\\nline2",
                            timestamp: "2020-01-01T00:00:00.000Z",
                            data: { foo: "bar" },
                        },
                    ],
                }),
            })
        );
        const after = Date.now();
        expect(response.status).toBe(200);
        const createArgs = (prisma.deviceLog.createMany as jest.Mock).mock.calls[0][0];
        const saved = createArgs.data[0];
        expect(saved.message).toBe("line1\\nline2");
        expect(saved.createdAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(saved.createdAt.getTime()).toBeLessThanOrEqual(after + 1000);
        expect(saved.data).toEqual(
            expect.objectContaining({
                foo: "bar",
                client_timestamp: "2020-01-01T00:00:00.000Z",
            })
        );
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
