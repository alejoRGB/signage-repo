/**
 * @jest-environment node
 */
import crypto from "crypto";
import { POST } from "@/app/api/device/register/route";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        device: {
            create: jest.fn(),
        },
    },
}));

jest.mock("@/lib/rate-limit", () => ({
    checkRateLimit: jest.fn(async () => true),
}));

describe("POST /api/device/register", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        (checkRateLimit as jest.Mock).mockResolvedValue(true);
    });

    it("returns 429 when rate limited", async () => {
        (checkRateLimit as jest.Mock).mockResolvedValue(false);

        const response = await POST(new Request("http://localhost/api/device/register", { method: "POST" }));
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(body.error).toMatch(/Too Many Requests/i);
        expect(prisma.device.create).not.toHaveBeenCalled();
    });

    it("creates a device and returns pairing payload", async () => {
        jest.spyOn(crypto, "randomInt").mockReturnValueOnce(123456);
        (prisma.device.create as jest.Mock).mockResolvedValue({
            token: "device-token-1",
            pairingCodeExpiresAt: new Date("2026-02-24T12:00:00.000Z"),
        });

        const response = await POST(new Request("http://localhost/api/device/register", { method: "POST" }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.pairing_code).toBe("123456");
        expect(body.device_token).toBe("device-token-1");
        expect(body.poll_interval).toBe(5000);
        expect(prisma.device.create).toHaveBeenCalledTimes(1);
    });

    it("retries on pairingCode unique collision and succeeds", async () => {
        jest.spyOn(crypto, "randomInt")
            .mockReturnValueOnce(111111)
            .mockReturnValueOnce(222222);

        (prisma.device.create as jest.Mock)
            .mockRejectedValueOnce({
                code: "P2002",
                meta: { target: ["pairingCode"] },
            })
            .mockResolvedValueOnce({
                token: "device-token-2",
                pairingCodeExpiresAt: new Date("2026-02-24T12:01:00.000Z"),
            });

        const response = await POST(new Request("http://localhost/api/device/register", { method: "POST" }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.pairing_code).toBe("222222");
        expect(prisma.device.create).toHaveBeenCalledTimes(2);
    });

    it("returns 503 when pairingCode collision retries are exhausted", async () => {
        jest.spyOn(crypto, "randomInt").mockReturnValue(333333);
        (prisma.device.create as jest.Mock).mockRejectedValue({
            code: "P2002",
            meta: { target: ["pairingCode"] },
        });

        const response = await POST(new Request("http://localhost/api/device/register", { method: "POST" }));
        const body = await response.json();

        expect(response.status).toBe(503);
        expect(body).toEqual({ error: "Unable to generate pairing code. Please retry." });
        expect(prisma.device.create).toHaveBeenCalledTimes(5);
    });

    it("does not expose internal error details on unexpected failures", async () => {
        jest.spyOn(crypto, "randomInt").mockReturnValueOnce(444444);
        (prisma.device.create as jest.Mock).mockRejectedValue(new Error("db connection string leaked"));
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

        const response = await POST(new Request("http://localhost/api/device/register", { method: "POST" }));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: "Internal server error" });
        expect(JSON.stringify(body)).not.toContain("db connection string leaked");
        expect(errorSpy).toHaveBeenCalled();
    });
});
