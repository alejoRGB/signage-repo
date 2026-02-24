/**
 * @jest-environment node
 */
import {
    abortExpiredSyncStartSessionById,
    abortExpiredSyncStartSessionsForUser,
    isSyncStartTimeoutExpired,
} from "@/lib/sync-start-timeout-service";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
    prisma: {
        syncSession: {
            findMany: jest.fn(),
        },
        $transaction: jest.fn(),
    },
}));

describe("sync-start-timeout-service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("detects expired start timeout only for pre-start statuses", () => {
        expect(
            isSyncStartTimeoutExpired(
                { status: "STARTING", startTimeoutAtMs: BigInt(1000) },
                1001
            )
        ).toBe(true);
        expect(
            isSyncStartTimeoutExpired(
                { status: "RUNNING", startTimeoutAtMs: BigInt(1000) },
                5000
            )
        ).toBe(false);
        expect(isSyncStartTimeoutExpired({ status: "STARTING", startTimeoutAtMs: null }, 5000)).toBe(false);
    });

    it("aborts expired sessions for a user and enqueues SYNC_STOP timeout commands", async () => {
        (prisma.syncSession.findMany as jest.Mock).mockResolvedValue([
            {
                id: "session-1",
                userId: "user-1",
                status: "STARTING",
                startTimeoutAtMs: BigInt(1_000),
                devices: [
                    { deviceId: "device-1", status: "ASSIGNED" },
                    { deviceId: "device-2", status: "READY" },
                ],
            },
        ]);

        const tx = {
            syncSession: {
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            syncSessionDevice: {
                updateMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
            syncDeviceCommand: {
                createMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
        };
        (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));

        const result = await abortExpiredSyncStartSessionsForUser("user-1", 2_000);

        expect(prisma.syncSession.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: "user-1",
                    status: { in: ["CREATED", "STARTING"] },
                    startTimeoutAtMs: expect.objectContaining({
                        lte: BigInt(2_000),
                    }),
                }),
            })
        );
        expect(tx.syncSession.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ id: "session-1" }),
                data: expect.objectContaining({
                    status: "ABORTED",
                    stoppedAt: new Date(2_000),
                }),
            })
        );
        expect(tx.syncSessionDevice.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ sessionId: "session-1" }),
                data: { status: "DISCONNECTED" },
            })
        );
        expect(tx.syncDeviceCommand.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.arrayContaining([
                    expect.objectContaining({
                        deviceId: "device-1",
                        sessionId: "session-1",
                        type: "SYNC_STOP",
                        dedupeKey: "session-1:SYNC_STOP:device-1:TIMEOUT",
                        status: "PENDING",
                    }),
                ]),
                skipDuplicates: true,
            })
        );
        expect(result).toEqual({ abortedSessionIds: ["session-1"] });
    });

    it("returns false when a specific session is not expired", async () => {
        (prisma.syncSession.findMany as jest.Mock).mockResolvedValue([]);

        const aborted = await abortExpiredSyncStartSessionById("session-x", 1_000);

        expect(aborted).toBe(false);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});

