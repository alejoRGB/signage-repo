/**
 * @jest-environment node
 */
import { GET as GET_ACTIVE_SYNC } from "@/app/api/sync/session/active/route";
import { POST as STOP_SYNC } from "@/app/api/sync/session/stop/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        syncSession: {
            findFirst: jest.fn(),
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

describe("SYNC-041 session metrics", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("ACTIVE returns computed drift percentiles and max", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });

        (prisma.syncSession.findFirst as jest.Mock).mockResolvedValue({
            id: "session-1",
            status: "RUNNING",
            devices: [
                {
                    status: "PLAYING",
                    resyncCount: 1,
                    healthScore: 0.95,
                    maxDriftMs: 40,
                    driftHistory: [{ driftMs: -10 }, { driftMs: 20 }],
                },
                {
                    status: "ERRORED",
                    resyncCount: 3,
                    healthScore: 0.4,
                    maxDriftMs: 100,
                    driftHistory: [{ driftMs: -40 }, { driftMs: 100 }],
                },
            ],
        });

        const response = await GET_ACTIVE_SYNC();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.metrics.sampleCount).toBe(4);
        expect(body.metrics.p50DriftMs).toBeCloseTo(30, 6);
        expect(body.metrics.p90DriftMs).toBeCloseTo(82, 6);
        expect(body.metrics.p95DriftMs).toBeCloseTo(91, 6);
        expect(body.metrics.p99DriftMs).toBeCloseTo(98.2, 6);
        expect(body.metrics.maxDriftMs).toBe(100);
        expect(body.metrics.totalResyncs).toBe(4);
        expect(body.metrics.devicesWithIssues).toBe(1);
    });

    it("STOP persists quality summary from runtime drift data", async () => {
        (getServerSession as jest.Mock).mockResolvedValue({
            user: { id: "user-1", role: "USER" },
        });

        (prisma.syncSession.findFirst as jest.Mock).mockResolvedValue({
            id: "session-1",
            userId: "user-1",
            status: "RUNNING",
            devices: [
                {
                    id: "ssd-1",
                    deviceId: "device-1",
                    status: "PLAYING",
                    driftHistory: [{ driftMs: 10 }, { driftMs: -30 }],
                    resyncCount: 2,
                    healthScore: 0.9,
                    maxDriftMs: 30,
                },
                {
                    id: "ssd-2",
                    deviceId: "device-2",
                    status: "DISCONNECTED",
                    driftHistory: null,
                    resyncCount: 1,
                    healthScore: 0.6,
                    maxDriftMs: 550,
                },
            ],
        });

        const tx = {
            syncSession: {
                update: jest.fn().mockResolvedValue({}),
                findUnique: jest.fn().mockResolvedValue({
                    id: "session-1",
                    status: "STOPPED",
                }),
            },
            syncSessionDevice: {
                updateMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
            syncDeviceCommand: {
                createMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
        };

        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));

        const response = await STOP_SYNC(
            new Request("http://localhost/api/sync/session/stop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: "session-1", reason: "USER_STOP" }),
            })
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(tx.syncSession.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    avgDriftMs: expect.any(Number),
                    p50DriftMs: expect.any(Number),
                    p90DriftMs: expect.any(Number),
                    p95DriftMs: expect.any(Number),
                    p99DriftMs: expect.any(Number),
                    maxDriftMs: 550,
                    totalResyncs: 3,
                    devicesWithIssues: 1,
                }),
            })
        );
        expect(body.qualitySummary).toEqual(
            expect.objectContaining({
                maxDriftMs: 550,
                totalResyncs: 3,
                devicesWithIssues: 1,
            })
        );
    });
});
