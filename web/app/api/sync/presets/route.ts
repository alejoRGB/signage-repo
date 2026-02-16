import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateSyncPresetSchema } from "@/lib/validations";
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

export async function GET() {
    const auth = await requireUserSession();
    if (auth.error) {
        return auth.error;
    }

    const presets = await prisma.syncPreset.findMany({
        where: { userId: auth.userId },
        include: syncPresetInclude,
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(presets);
}

export async function POST(request: Request) {
    const auth = await requireUserSession();
    if (auth.error) {
        return auth.error;
    }

    try {
        const payload = await request.json();
        const result = CreateSyncPresetSchema.safeParse(payload);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0]?.message ?? "Invalid payload" },
                { status: 400 }
            );
        }

        const validated = await validateSyncPresetInput({
            userId: auth.userId,
            mode: result.data.mode,
            durationMs: result.data.durationMs,
            presetMediaId: result.data.presetMediaId,
            devices: result.data.devices,
        });

        const contentProfile = result.data.contentProfile;
        const preset = await prisma.syncPreset.create({
            data: {
                userId: auth.userId,
                name: result.data.name,
                mode: result.data.mode,
                durationMs: result.data.durationMs,
                presetMediaId: validated.presetMediaId,
                maxResolution: contentProfile?.maxResolution,
                motionIntensity: contentProfile?.motionIntensity,
                hasText: contentProfile?.hasText ?? false,
                devices: {
                    createMany: {
                        data: validated.assignments,
                    },
                },
            },
            include: syncPresetInclude,
        });

        return NextResponse.json(preset, { status: 201 });
    } catch (error) {
        if (error instanceof SyncPresetValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        console.error("Create sync preset error:", error);
        return NextResponse.json(
            { error: "Failed to create sync preset" },
            { status: 500 }
        );
    }
}
