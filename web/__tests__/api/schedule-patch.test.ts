/**
 * @jest-environment node
 */
import { PATCH } from "@/app/api/schedules/[scheduleId]/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        schedule: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        playlist: {
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

describe("PATCH /api/schedules/[scheduleId]", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns 400 when schedule items overlap (backend validation)", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user1" } });
        (prisma.schedule.findUnique as jest.Mock).mockResolvedValue({ userId: "user1" });
        (prisma.playlist.findMany as jest.Mock).mockResolvedValue([
            { id: "pl1", userId: "user1" },
        ]);

        const req = new Request("http://localhost/api/schedules/s1", {
            method: "PATCH",
            body: JSON.stringify({
                name: "My Schedule",
                items: [
                    { dayOfWeek: 1, startTime: "10:00", endTime: "11:00", playlistId: "pl1" },
                    { dayOfWeek: 1, startTime: "10:30", endTime: "11:30", playlistId: "pl1" },
                ],
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await PATCH(req, { params: Promise.resolve({ scheduleId: "s1" }) });
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain("Schedule overlap detected");
        expect(prisma.schedule.update).not.toHaveBeenCalled();
    });

    it("persists valid non-overlapping schedule items", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user1" } });
        (prisma.schedule.findUnique as jest.Mock).mockResolvedValue({ userId: "user1" });
        (prisma.playlist.findMany as jest.Mock).mockResolvedValue([
            { id: "pl1", userId: "user1" },
            { id: "pl2", userId: "user1" },
        ]);
        (prisma.schedule.update as jest.Mock).mockResolvedValue({ id: "s1" });

        const req = new Request("http://localhost/api/schedules/s1", {
            method: "PATCH",
            body: JSON.stringify({
                name: "My Schedule",
                items: [
                    { dayOfWeek: 1, startTime: "10:00", endTime: "11:00", playlistId: "pl1" },
                    { dayOfWeek: 1, startTime: "11:00", endTime: "12:00", playlistId: "pl2" },
                ],
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await PATCH(req, { params: Promise.resolve({ scheduleId: "s1" }) });

        expect(res.status).toBe(200);
        expect(prisma.schedule.update).toHaveBeenCalled();
    });
});
