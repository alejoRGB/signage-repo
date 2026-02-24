/**
 * @jest-environment node
 */
import { PUT } from "@/app/api/devices/[id]/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        device: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        playlist: {
            findUnique: jest.fn(),
        },
        schedule: {
            findUnique: jest.fn(),
        },
    },
}));

jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
    authOptions: {},
}));

describe("PUT /api/devices/[id]", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });
        (prisma.device.findUnique as jest.Mock).mockResolvedValue({
            userId: "user-1",
        });
    });

    it("does not expose internal error details on unexpected failures", async () => {
        (prisma.device.update as jest.Mock).mockRejectedValue(new Error("DB blew up"));

        const response = await PUT(
            new Request("http://localhost/api/devices/device-1", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Updated Device" }),
            }),
            { params: Promise.resolve({ id: "device-1" }) }
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: "Failed to update device" });
        expect(body.error).not.toMatch(/DB blew up/i);
    });
});

