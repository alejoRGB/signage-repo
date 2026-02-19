import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeviceCommandsPollSchema } from "@/lib/validations";
import { getDeviceByTokenForCommandFlow } from "@/lib/sync-command-service";
import { toJsonSafe } from "@/lib/sync-session-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const payload = {
            device_token: searchParams.get("device_token"),
            limit: searchParams.get("limit") ?? undefined,
        };
        const result = DeviceCommandsPollSchema.safeParse(payload);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0]?.message ?? "Invalid request" },
                { status: 400 }
            );
        }

        const { checkRateLimit } = await import("@/lib/rate-limit");
        const isAllowed = await checkRateLimit(result.data.device_token, "device_commands");
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

        const limit = Math.min(Math.max(result.data.limit, 1), 50);
        const commands = await prisma.syncDeviceCommand.findMany({
            where: {
                deviceId: device.id,
                status: "PENDING",
            },
            orderBy: {
                createdAt: "asc",
            },
            take: limit,
        });

        return NextResponse.json(
            toJsonSafe({
                commands,
            })
        );
    } catch (error) {
        console.error("[DEVICE_COMMANDS_GET]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
