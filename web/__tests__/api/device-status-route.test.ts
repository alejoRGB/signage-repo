/**
 * @jest-environment node
 */
import { GET } from "@/app/api/device/status/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        device: {
            findUnique: jest.fn(),
        },
    },
}));

jest.mock("@/lib/rate-limit", () => ({
    checkRateLimit: jest.fn(async () => true),
}));

describe("GET /api/device/status", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("accepts X-Device-Token header", async () => {
        (prisma.device.findUnique as jest.Mock).mockResolvedValue({
            id: "device-1",
            userId: "user-1",
            name: "Screen 1",
        });

        const response = await GET(
            new Request("http://localhost/api/device/status", {
                headers: { "X-Device-Token": "token-1" },
            })
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(prisma.device.findUnique).toHaveBeenCalledWith({ where: { token: "token-1" } });
        expect(body).toEqual({ status: "paired", device_name: "Screen 1" });
    });

    it("accepts legacy query token fallback", async () => {
        (prisma.device.findUnique as jest.Mock).mockResolvedValue({
            id: "device-1",
            userId: null,
            pairingCode: "123456",
        });

        const response = await GET(new Request("http://localhost/api/device/status?token=legacy-1"));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(prisma.device.findUnique).toHaveBeenCalledWith({ where: { token: "legacy-1" } });
        expect(body.status).toBe("unpaired");
    });
});
