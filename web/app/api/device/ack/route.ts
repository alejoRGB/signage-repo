import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeviceCommandAckSchema } from "@/lib/validations";
import { getDeviceByTokenForCommandFlow } from "@/lib/sync-command-service";
import { persistDeviceSyncRuntime } from "@/lib/sync-runtime-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const result = DeviceCommandAckSchema.safeParse(payload);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0]?.message ?? "Invalid payload" },
                { status: 400 }
            );
        }

        const { checkRateLimit } = await import("@/lib/rate-limit");
        const isAllowed = await checkRateLimit(result.data.device_token);
        if (!isAllowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const device = await getDeviceByTokenForCommandFlow(result.data.device_token);
        if (!device) {
            return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
        }

        if (device.user && !device.user.isActive) {
            return NextResponse.json({ error: "Account suspended" }, { status: 403 });
        }

        const command = await prisma.syncDeviceCommand.findFirst({
            where: {
                id: result.data.command_id,
                deviceId: device.id,
            },
            select: {
                id: true,
                sessionId: true,
                status: true,
            },
        });

        if (!command) {
            return NextResponse.json({ error: "Command not found" }, { status: 404 });
        }

        if (command.status === "ACKED" && result.data.status === "ACKED") {
            return NextResponse.json({ success: true, idempotent: true });
        }

        await prisma.syncDeviceCommand.update({
            where: { id: command.id },
            data: {
                status: result.data.status,
                error: result.data.error,
                ackedAt: result.data.status === "PENDING" ? null : new Date(),
            },
        });

        const runtimePayload =
            result.data.sync_runtime ??
            (result.data.sync_status
                ? {
                      session_id: command.sessionId,
                      status: result.data.sync_status,
                  }
                : null);
        if (runtimePayload) {
            await persistDeviceSyncRuntime(device.id, {
                sessionId: runtimePayload.session_id ?? command.sessionId,
                status: runtimePayload.status,
                driftMs: runtimePayload.drift_ms ?? null,
                resyncCount: runtimePayload.resync_count ?? null,
                clockOffsetMs: runtimePayload.clock_offset_ms ?? null,
                cpuTemp: runtimePayload.cpu_temp ?? null,
                throttled: runtimePayload.throttled ?? null,
                healthScore: runtimePayload.health_score ?? null,
                avgDriftMs: runtimePayload.avg_drift_ms ?? null,
                maxDriftMs: runtimePayload.max_drift_ms ?? null,
                resyncRate: runtimePayload.resync_rate ?? null,
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[DEVICE_ACK_POST]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
