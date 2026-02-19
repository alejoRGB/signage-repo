import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_SYNC_SESSION_STATUSES, syncSessionInclude, toJsonSafe } from "@/lib/sync-session-service";
import { computeSyncSessionMetrics } from "@/lib/sync-metrics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    const session = await prisma.syncSession.findFirst({
        where: {
            userId: auth.userId,
            status: { in: ACTIVE_SYNC_SESSION_STATUSES },
        },
        include: syncSessionInclude,
        orderBy: {
            createdAt: "desc",
        },
    });

    const sessionDevices = Array.isArray(session?.devices) ? session.devices : [];
    const metrics = session
        ? computeSyncSessionMetrics(
              sessionDevices.map((device) => ({
                  status: device.status,
                  resyncCount: device.resyncCount,
                  healthScore: device.healthScore,
                  maxDriftMs: device.maxDriftMs,
                  driftHistory: device.driftHistory,
              }))
          )
        : null;

    return NextResponse.json(
        toJsonSafe({
            session,
            metrics,
        }),
        {
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                Pragma: "no-cache",
                Expires: "0",
                "Surrogate-Control": "no-store",
            },
        }
    );
}
