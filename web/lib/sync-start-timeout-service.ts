import { prisma } from "@/lib/prisma";
import { buildStopPayload } from "@/lib/sync-command-service";
import { SYNC_DEVICE_COMMAND_TYPE, SYNC_STOP_REASON } from "@/types/sync";
import { Prisma, SyncSessionStatus } from "@prisma/client";

const START_TIMEOUT_ELIGIBLE_STATUSES = [SyncSessionStatus.CREATED, SyncSessionStatus.STARTING] as const;
const START_TIMEOUT_ELIGIBLE_STATUS_SET = new Set<SyncSessionStatus>(START_TIMEOUT_ELIGIBLE_STATUSES);

type AbortExpiredSessionsWhere = {
    userId?: string;
    sessionId?: string;
};

type ExpiredSessionCandidate = {
    id: string;
    userId: string;
    status: SyncSessionStatus;
    startTimeoutAtMs: bigint | null;
    devices: Array<{
        deviceId: string;
        status: string;
    }>;
};

export function isSyncStartTimeoutExpired(
    session:
        | {
              status?: SyncSessionStatus | string | null;
              startTimeoutAtMs?: bigint | number | null;
          }
        | null
        | undefined,
    nowMs = Date.now()
) {
    if (!session) {
        return false;
    }

    if (!session.status || !START_TIMEOUT_ELIGIBLE_STATUS_SET.has(session.status as SyncSessionStatus)) {
        return false;
    }

    if (session.startTimeoutAtMs === null || session.startTimeoutAtMs === undefined) {
        return false;
    }

    const timeoutMs =
        typeof session.startTimeoutAtMs === "bigint"
            ? Number(session.startTimeoutAtMs)
            : Number(session.startTimeoutAtMs);

    return Number.isFinite(timeoutMs) && timeoutMs <= nowMs;
}

async function findExpiredSessions(
    where: AbortExpiredSessionsWhere,
    nowMs: number
): Promise<ExpiredSessionCandidate[]> {
    const prismaWhere: Prisma.SyncSessionWhereInput = {
        status: { in: [...START_TIMEOUT_ELIGIBLE_STATUSES] },
        startTimeoutAtMs: { not: null, lte: BigInt(nowMs) },
    };

    if (where.userId) {
        prismaWhere.userId = where.userId;
    }

    if (where.sessionId) {
        prismaWhere.id = where.sessionId;
    }

    return prisma.syncSession.findMany({
        where: prismaWhere,
        select: {
            id: true,
            userId: true,
            status: true,
            startTimeoutAtMs: true,
            devices: {
                select: {
                    deviceId: true,
                    status: true,
                },
            },
        },
    });
}

async function abortExpiredSyncStartSessionsInternal(where: AbortExpiredSessionsWhere, nowMs = Date.now()) {
    const expiredSessions = await findExpiredSessions(where, nowMs);
    if (expiredSessions.length === 0) {
        return { abortedSessionIds: [] as string[] };
    }

    const abortedSessionIds: string[] = [];

    await prisma.$transaction(async (tx) => {
        for (const session of expiredSessions) {
            const updated = await tx.syncSession.updateMany({
                where: {
                    id: session.id,
                    status: { in: [...START_TIMEOUT_ELIGIBLE_STATUSES] },
                },
                data: {
                    status: SyncSessionStatus.ABORTED,
                    stoppedAt: new Date(nowMs),
                },
            });

            if (updated.count === 0) {
                continue;
            }

            abortedSessionIds.push(session.id);

            await tx.syncSessionDevice.updateMany({
                where: {
                    sessionId: session.id,
                    status: { not: "ERRORED" },
                },
                data: {
                    status: "DISCONNECTED",
                },
            });

            if (session.devices.length > 0) {
                await tx.syncDeviceCommand.createMany({
                    data: session.devices.map((device) => ({
                        deviceId: device.deviceId,
                        sessionId: session.id,
                        type: SYNC_DEVICE_COMMAND_TYPE.SYNC_STOP,
                        payload: buildStopPayload(session.id, SYNC_STOP_REASON.TIMEOUT),
                        dedupeKey: `${session.id}:SYNC_STOP:${device.deviceId}:${SYNC_STOP_REASON.TIMEOUT}`,
                        status: "PENDING" as const,
                    })),
                    skipDuplicates: true,
                });
            }
        }
    });

    return { abortedSessionIds };
}

export async function abortExpiredSyncStartSessionsForUser(userId: string, nowMs = Date.now()) {
    if (!userId) {
        return { abortedSessionIds: [] as string[] };
    }
    return abortExpiredSyncStartSessionsInternal({ userId }, nowMs);
}

export async function abortExpiredSyncStartSessionById(sessionId: string, nowMs = Date.now()) {
    if (!sessionId) {
        return false;
    }
    const result = await abortExpiredSyncStartSessionsInternal({ sessionId }, nowMs);
    return result.abortedSessionIds.includes(sessionId);
}
