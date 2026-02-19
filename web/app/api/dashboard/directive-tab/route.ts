import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DIRECTIVE_TAB } from "@/lib/directive-tabs";
import { STOPPABLE_SYNC_SESSION_STATUSES, resolveStopStatus } from "@/lib/sync-session-service";
import { buildStopPayload } from "@/lib/sync-command-service";
import { SYNC_DEVICE_COMMAND_TYPE, SYNC_STOP_REASON } from "@/types/sync";

const UpdateDirectiveTabSchema = z.object({
    activeDirectiveTab: z.enum([DIRECTIVE_TAB.SCHEDULES, DIRECTIVE_TAB.SYNC_VIDEOWALL]),
});

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "USER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { activeDirectiveTab: true },
    });

    return NextResponse.json({
        activeDirectiveTab: user?.activeDirectiveTab ?? DIRECTIVE_TAB.SCHEDULES,
    });
}

export async function PATCH(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "USER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const json = await request.json();
        const result = UpdateDirectiveTabSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0]?.message ?? "Invalid payload" },
                { status: 400 }
            );
        }

        const isSchedulesDirective = result.data.activeDirectiveTab === DIRECTIVE_TAB.SCHEDULES;
        const stopReason = SYNC_STOP_REASON.USER_STOP;
        const stopStatus = resolveStopStatus(stopReason);

        const user = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                activeDirectiveTab: result.data.activeDirectiveTab,
            },
            select: { activeDirectiveTab: true },
        });

        if (isSchedulesDirective) {
            const activeSessions = await prisma.syncSession.findMany({
                where: {
                    userId: session.user.id,
                    status: { in: STOPPABLE_SYNC_SESSION_STATUSES },
                },
                select: {
                    id: true,
                    devices: {
                        select: {
                            deviceId: true,
                        },
                    },
                },
            });

            if (activeSessions.length > 0) {
                const sessionIds = activeSessions.map((activeSession) => activeSession.id);
                const stoppedAt = new Date();
                const stopCommands = activeSessions.flatMap((activeSession) =>
                    activeSession.devices.map((device) => ({
                        deviceId: device.deviceId,
                        sessionId: activeSession.id,
                        type: SYNC_DEVICE_COMMAND_TYPE.SYNC_STOP,
                        payload: buildStopPayload(activeSession.id, stopReason),
                        dedupeKey: `${activeSession.id}:SYNC_STOP:${device.deviceId}:${stopReason}`,
                        status: "PENDING" as const,
                    }))
                );

                await prisma.$transaction([
                    prisma.syncSession.updateMany({
                        where: {
                            id: { in: sessionIds },
                            status: { in: STOPPABLE_SYNC_SESSION_STATUSES },
                        },
                        data: {
                            status: stopStatus,
                            stoppedAt,
                        },
                    }),
                    prisma.syncSessionDevice.updateMany({
                        where: {
                            sessionId: { in: sessionIds },
                            status: { not: "ERRORED" },
                        },
                        data: {
                            status: "DISCONNECTED",
                        },
                    }),
                    ...(stopCommands.length > 0
                        ? [
                            prisma.syncDeviceCommand.createMany({
                                data: stopCommands,
                                skipDuplicates: true,
                            }),
                        ]
                        : []),
                ]);
            }
        }

        return NextResponse.json({ activeDirectiveTab: user.activeDirectiveTab });
    } catch (error) {
        console.error("Update active directive tab error:", error);
        return NextResponse.json(
            { error: "Failed to update active tab" },
            { status: 500 }
        );
    }
}
