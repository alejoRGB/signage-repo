import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UpdateSyncPresetSchema } from "@/lib/validations";
import { SYNC_PRESET_MODE } from "@/types/sync";
import { validateSyncPresetInput, SyncPresetValidationError, syncPresetInclude } from "@/lib/sync-preset-service";

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

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireUserSession();
    if (auth.error) {
        return auth.error;
    }
    const { id } = await params;

    const preset = await prisma.syncPreset.findFirst({
        where: {
            id,
            userId: auth.userId,
        },
        include: syncPresetInclude,
    });

    if (!preset) {
        return NextResponse.json({ error: "Sync preset not found" }, { status: 404 });
    }

    return NextResponse.json(preset);
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireUserSession();
    if (auth.error) {
        return auth.error;
    }
    const { id } = await params;

    try {
        const existingPreset = await prisma.syncPreset.findFirst({
            where: {
                id,
                userId: auth.userId,
            },
            include: {
                devices: {
                    select: {
                        deviceId: true,
                        mediaItemId: true,
                    },
                },
            },
        });

        if (!existingPreset) {
            return NextResponse.json({ error: "Sync preset not found" }, { status: 404 });
        }

        const payload = await request.json();
        const result = UpdateSyncPresetSchema.safeParse(payload);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0]?.message ?? "Invalid payload" },
                { status: 400 }
            );
        }

        const nextMode = result.data.mode ?? existingPreset.mode;
        const nextDurationMs = result.data.durationMs ?? existingPreset.durationMs;
        const nextPresetMediaId =
            result.data.presetMediaId !== undefined
                ? result.data.presetMediaId
                : existingPreset.presetMediaId;
        const nextDevices =
            result.data.devices ??
            existingPreset.devices.map((device) => ({
                deviceId: device.deviceId,
                mediaItemId: device.mediaItemId,
            }));

        const validated = await validateSyncPresetInput({
            userId: auth.userId,
            mode: nextMode,
            durationMs: nextDurationMs,
            presetMediaId: nextPresetMediaId,
            devices: nextDevices,
        });

        const updatedPreset = await prisma.$transaction(async (tx) => {
            const contentProfile = result.data.contentProfile;

            await tx.syncPreset.update({
                where: { id },
                data: {
                    name: result.data.name ?? existingPreset.name,
                    mode: nextMode,
                    durationMs: nextDurationMs,
                    presetMediaId:
                        nextMode === SYNC_PRESET_MODE.COMMON ? validated.presetMediaId : null,
                    ...(contentProfile
                        ? {
                              maxResolution:
                                  contentProfile.maxResolution ?? existingPreset.maxResolution,
                              motionIntensity:
                                  contentProfile.motionIntensity ?? existingPreset.motionIntensity,
                              ...(contentProfile.hasText !== undefined
                                  ? { hasText: contentProfile.hasText }
                                  : {}),
                          }
                        : {}),
                },
            });

            await tx.syncPresetDevice.deleteMany({
                where: {
                    presetId: id,
                },
            });

            await tx.syncPresetDevice.createMany({
                data: validated.assignments.map((assignment) => ({
                    presetId: id,
                    deviceId: assignment.deviceId,
                    mediaItemId: assignment.mediaItemId,
                })),
            });

            return tx.syncPreset.findFirst({
                where: {
                    id,
                    userId: auth.userId,
                },
                include: syncPresetInclude,
            });
        });

        return NextResponse.json(updatedPreset);
    } catch (error) {
        if (error instanceof SyncPresetValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        console.error("Update sync preset error:", error);
        return NextResponse.json(
            { error: "Failed to update sync preset" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireUserSession();
    if (auth.error) {
        return auth.error;
    }
    const { id } = await params;

    const deleted = await prisma.syncPreset.deleteMany({
        where: {
            id,
            userId: auth.userId,
        },
    });

    if (deleted.count === 0) {
        return NextResponse.json({ error: "Sync preset not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
