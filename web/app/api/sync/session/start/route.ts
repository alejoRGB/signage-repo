import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StartSyncSessionSchema } from "@/lib/validations";
import {
    ACTIVE_SYNC_SESSION_STATUSES,
    computePreparationBufferMs,
    syncSessionInclude,
    toJsonSafe,
} from "@/lib/sync-session-service";
import { buildPreparePayload } from "@/lib/sync-command-service";
import { selectInitialMasterDeviceId } from "@/lib/sync-master-election";
import { SYNC_DEVICE_COMMAND_TYPE } from "@/types/sync";

async function requireUserSession() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    if (session.user.role !== "USER") {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }

    return { userId: session.user.id };
}

export async function POST(request: Request) {
    const auth = await requireUserSession();
    if (auth.error) {
        return auth.error;
    }

    try {
        const payload = await request.json();
        const result = StartSyncSessionSchema.safeParse(payload);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0]?.message ?? "Invalid payload" },
                { status: 400 }
            );
        }

        const activeUserSession = await prisma.syncSession.findFirst({
            where: {
                userId: auth.userId,
                status: { in: ACTIVE_SYNC_SESSION_STATUSES },
            },
            select: { id: true },
        });

        if (activeUserSession) {
            return NextResponse.json(
                { error: "An active sync session already exists for this user", sessionId: activeUserSession.id },
                { status: 409 }
            );
        }

        const preset = await prisma.syncPreset.findFirst({
            where: {
                id: result.data.presetId,
                userId: auth.userId,
            },
            include: {
                presetMedia: {
                    select: {
                        id: true,
                        filename: true,
                        width: true,
                        height: true,
                        fps: true,
                    },
                },
                devices: {
                    include: {
                        device: {
                            select: {
                                id: true,
                                name: true,
                                lastSeenAt: true,
                            },
                        },
                        mediaItem: {
                            select: {
                                id: true,
                                filename: true,
                                width: true,
                                height: true,
                                fps: true,
                            },
                        },
                    },
                },
            },
        });

        if (!preset) {
            return NextResponse.json({ error: "Sync preset not found" }, { status: 404 });
        }

        if (preset.devices.length < 2) {
            return NextResponse.json(
                { error: "Sync preset must have at least two assigned devices" },
                { status: 400 }
            );
        }

        const deviceIds = preset.devices.map((device) => device.deviceId);

        const existingDeviceSession = await prisma.syncSessionDevice.findFirst({
            where: {
                deviceId: { in: deviceIds },
                session: {
                    status: { in: ACTIVE_SYNC_SESSION_STATUSES },
                },
            },
            select: {
                deviceId: true,
                sessionId: true,
            },
        });

        if (existingDeviceSession) {
            return NextResponse.json(
                {
                    error: "One or more devices are already in an active sync session",
                    deviceId: existingDeviceSession.deviceId,
                    sessionId: existingDeviceSession.sessionId,
                },
                { status: 409 }
            );
        }

        const nowMs = Date.now();
        const ONLINE_HEARTBEAT_WINDOW_MS = 5 * 60 * 1000;
        const offlineDevices = preset.devices
            .map((assignment) => {
                const lastSeenAt = assignment.device.lastSeenAt;
                const ageMs = lastSeenAt ? nowMs - lastSeenAt.getTime() : Number.POSITIVE_INFINITY;
                const isOnline = !!lastSeenAt && ageMs <= ONLINE_HEARTBEAT_WINDOW_MS;

                if (isOnline) {
                    return null;
                }

                return {
                    deviceId: assignment.deviceId,
                    deviceName: assignment.device.name ?? assignment.deviceId,
                    lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
                    reason: lastSeenAt ? "stale_heartbeat" : "missing_heartbeat",
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

        if (offlineDevices.length > 0) {
            return NextResponse.json(
                {
                    error: "All selected devices must be online before starting sync",
                    offlineDevices,
                },
                { status: 400 }
            );
        }

        const hasColdDevice = preset.devices.some((assignment) => {
            if (!assignment.device.lastSeenAt) {
                return true;
            }

            return nowMs - assignment.device.lastSeenAt.getTime() > 60 * 1000;
        });

        const preparationBufferMs = computePreparationBufferMs({
            requestedBufferMs: result.data.preparationBufferMs,
            deviceCount: deviceIds.length,
            hasColdDevice,
        });
        const initialMasterDeviceId = selectInitialMasterDeviceId(
            preset.devices.map((assignment) => ({
                deviceId: assignment.deviceId,
                lastSeenAt: assignment.device.lastSeenAt,
            }))
        );
        const startAtMs = nowMs + preparationBufferMs;
        const timeoutAtMs = nowMs + result.data.startTimeoutMs;

        const createdSession = await prisma.$transaction(async (tx) => {
            const session = await tx.syncSession.create({
                data: {
                    userId: auth.userId,
                    presetId: preset.id,
                    status: "STARTING",
                    durationMs: preset.durationMs,
                    preparationBufferMs,
                    startAtMs: BigInt(startAtMs),
                    masterDeviceId: initialMasterDeviceId,
                },
            });

            await tx.syncSessionDevice.createMany({
                data: deviceIds.map((deviceId) => ({
                    sessionId: session.id,
                    deviceId,
                    status: "ASSIGNED",
                })),
            });

            const prepareCommands = preset.devices.map((assignment) => {
                const media =
                    preset.mode === "COMMON"
                        ? preset.presetMedia
                        : assignment.mediaItem;

                if (!media) {
                    throw new Error(
                        `Sync preset ${preset.id} is missing media mapping for device ${assignment.deviceId}`
                    );
                }

                return {
                    deviceId: assignment.deviceId,
                    sessionId: session.id,
                    type: SYNC_DEVICE_COMMAND_TYPE.SYNC_PREPARE,
                    dedupeKey: `${session.id}:SYNC_PREPARE:${assignment.deviceId}`,
                    payload: buildPreparePayload({
                        sessionId: session.id,
                        presetId: preset.id,
                        mode: preset.mode,
                        startAtMs,
                        durationMs: preset.durationMs,
                        deviceId: assignment.deviceId,
                        masterDeviceId: initialMasterDeviceId,
                        media: {
                            mediaId: media.id,
                            filename: media.filename ?? null,
                            width: media.width ?? null,
                            height: media.height ?? null,
                            fps: media.fps ?? null,
                        },
                    }),
                };
            });

            await tx.syncDeviceCommand.createMany({
                data: prepareCommands,
                skipDuplicates: true,
            });

            return tx.syncSession.findUnique({
                where: { id: session.id },
                include: syncSessionInclude,
            });
        });

        return NextResponse.json(
            toJsonSafe({
                session: createdSession,
                startTimeoutMs: result.data.startTimeoutMs,
                timeoutAtMs,
            }),
            { status: 201 }
        );
    } catch (error) {
        console.error("Start sync session error:", error);
        return NextResponse.json(
            { error: "Failed to start sync session" },
            { status: 500 }
        );
    }
}
