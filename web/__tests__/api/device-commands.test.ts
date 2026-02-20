/**
 * @jest-environment node
 */
import { GET as GET_COMMANDS } from "@/app/api/device/commands/route";
import { POST as ACK_COMMAND } from "@/app/api/device/ack/route";
import { prisma } from "@/lib/prisma";
import { persistDeviceSyncRuntime } from "@/lib/sync-runtime-service";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        device: {
            findUnique: jest.fn(),
        },
        syncDeviceCommand: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
        },
    },
}));

jest.mock("@/lib/rate-limit", () => ({
    checkRateLimit: jest.fn(async () => true),
}));

jest.mock("@/lib/sync-runtime-service", () => ({
    persistDeviceSyncRuntime: jest.fn(),
}));

describe("Device commands API", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.device.findUnique as jest.Mock).mockResolvedValue({
            id: "device-1",
            token: "token-1",
            user: { isActive: true },
        });
    });

    it("GET returns pending commands for valid device token", async () => {
        (prisma.syncDeviceCommand.findMany as jest.Mock).mockResolvedValue([
            { id: "cmd-1", status: "PENDING" },
        ]);

        const response = await GET_COMMANDS(
            new Request("http://localhost/api/device/commands?device_token=token-1")
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.commands).toEqual([{ id: "cmd-1", status: "PENDING" }]);
    });

    it("GET rejects missing token", async () => {
        const response = await GET_COMMANDS(new Request("http://localhost/api/device/commands"));
        expect(response.status).toBe(400);
    });

    it("POST /ack updates command status and persists runtime when provided", async () => {
        (prisma.syncDeviceCommand.findFirst as jest.Mock).mockResolvedValue({
            id: "cmd-1",
            sessionId: "session-1",
            status: "PENDING",
        });

        const response = await ACK_COMMAND(
            new Request("http://localhost/api/device/ack", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device_token: "token-1",
                    command_id: "cmd-1",
                    status: "ACKED",
                    sync_runtime: {
                        session_id: "session-1",
                        status: "READY",
                        drift_ms: 10,
                    },
                }),
            })
        );

        expect(response.status).toBe(200);
        expect(prisma.syncDeviceCommand.update).toHaveBeenCalled();
        expect(persistDeviceSyncRuntime).toHaveBeenCalledWith(
            "device-1",
            expect.objectContaining({
                sessionId: "session-1",
                status: "READY",
                driftMs: 10,
            })
        );
    });

    it("POST /ack is idempotent for already ACKED commands", async () => {
        (prisma.syncDeviceCommand.findFirst as jest.Mock).mockResolvedValue({
            id: "cmd-1",
            sessionId: "session-1",
            status: "ACKED",
        });

        const response = await ACK_COMMAND(
            new Request("http://localhost/api/device/ack", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device_token: "token-1",
                    command_id: "cmd-1",
                    status: "ACKED",
                }),
            })
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.idempotent).toBe(true);
        expect(prisma.syncDeviceCommand.update).not.toHaveBeenCalled();
    });

    it("POST /ack maps FAILED command without runtime to ERRORED sync status", async () => {
        (prisma.syncDeviceCommand.findFirst as jest.Mock).mockResolvedValue({
            id: "cmd-1",
            sessionId: "session-1",
            status: "PENDING",
        });

        const response = await ACK_COMMAND(
            new Request("http://localhost/api/device/ack", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    device_token: "token-1",
                    command_id: "cmd-1",
                    status: "FAILED",
                    error: "Local media not found",
                }),
            })
        );

        expect(response.status).toBe(200);
        expect(prisma.syncDeviceCommand.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: "FAILED",
                    error: "Local media not found",
                }),
            })
        );
        expect(persistDeviceSyncRuntime).toHaveBeenCalledWith(
            "device-1",
            expect.objectContaining({
                sessionId: "session-1",
                status: "ERRORED",
            })
        );
    });
});
