import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractSyncRuntimeFromFormData, persistDeviceSyncRuntime } from "@/lib/sync-runtime-service";
import { maybeReelectMasterForSession } from "@/lib/sync-master-election";
import { maybeQueueSyncRejoinPrepareOnHeartbeat } from "@/lib/sync-device-rejoin";
import { rateLimitKeyForDeviceToken } from "@/lib/rate-limit-key";
import { ACTIVE_SYNC_SESSION_STATUSES } from "@/lib/sync-session-service";
import { MAX_DEVICE_PREVIEW_SIZE_BYTES } from "@/lib/device-preview";

export const dynamic = "force-dynamic";

const MASTER_REELECTION_THROTTLE_MS = 10_000;
const MASTER_REELECTION_RETENTION_MS = 5 * 60_000;
const lastMasterReelectionBySession = new Map<string, number>();
const DEFAULT_REJOIN_BUDGET_MS = 150;
const DEFAULT_REELECTION_BUDGET_MS = 200;

function parseOptionalFormNumber(value: FormDataEntryValue | null): number | null {
    if (typeof value !== "string" || value.trim() === "") {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function shouldRunMasterReelection(sessionId: string, nowMs: number) {
    const lastRunMs = lastMasterReelectionBySession.get(sessionId);
    if (typeof lastRunMs === "number" && nowMs - lastRunMs < MASTER_REELECTION_THROTTLE_MS) {
        return false;
    }

    lastMasterReelectionBySession.set(sessionId, nowMs);

    if (lastMasterReelectionBySession.size > 1000) {
        for (const [trackedSessionId, trackedAtMs] of lastMasterReelectionBySession.entries()) {
            if (nowMs - trackedAtMs > MASTER_REELECTION_RETENTION_MS) {
                lastMasterReelectionBySession.delete(trackedSessionId);
            }
        }
    }

    return true;
}

function parsePositiveIntegerEnv(name: string, fallback: number) {
    const raw = process.env[name];
    if (!raw) {
        return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function runBestEffortWithBudget<T>(
    label: string,
    budgetMs: number,
    task: () => Promise<T>
): Promise<{ completed: boolean; timedOut: boolean }> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let timedOut = false;
    try {
        await Promise.race([
            task(),
            new Promise<void>((resolve) => {
                timer = setTimeout(() => {
                    timedOut = true;
                    resolve();
                }, budgetMs);
            }),
        ]);
    } catch (error) {
        console.error(`[${label}]`, error);
        return { completed: false, timedOut: false };
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }

    if (timedOut) {
        console.warn(`[${label}] timed out after ${budgetMs}ms (skipped for liveness path)`);
        return { completed: false, timedOut: true };
    }

    return { completed: true, timedOut: false };
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const deviceToken = formData.get("device_token");
        const playingPlaylistIdValue = formData.get("playing_playlist_id");
        const currentContentNameValue = formData.get("current_content_name");
        const previewFile = formData.get("preview");
        const cpuTempValue = parseOptionalFormNumber(formData.get("cpu_temp"));
        const syncRuntime = extractSyncRuntimeFromFormData(formData);

        if (!deviceToken || typeof deviceToken !== "string") {
            return NextResponse.json({ error: "device_token is required" }, { status: 400 });
        }

        const { checkRateLimit } = await import("@/lib/rate-limit");
        const isAllowed = await checkRateLimit(rateLimitKeyForDeviceToken(deviceToken), "device_heartbeat");
        if (!isAllowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const device = await prisma.device.findUnique({
            where: { token: deviceToken },
            include: {
                user: {
                    select: { isActive: true }
                },
                syncSessionDevices: {
                    where: {
                        session: {
                            status: {
                                in: ACTIVE_SYNC_SESSION_STATUSES,
                            },
                        },
                    },
                    select: { id: true },
                    take: 1,
                },
            }
        });

        if (!device) {
            return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
        }

        if (device.user && !device.user.isActive) {
            return NextResponse.json({ error: "Account suspended" }, { status: 403 });
        }

        const updateData: {
            status: string;
            lastSeenAt: Date;
            playingPlaylistId?: string | null;
            currentContentName?: string | null;
            previewImageUrl?: string;
            previewCapturedAt?: Date;
            cpuTemp?: number;
            cpuTempUpdatedAt?: Date;
        } = {
            status: "online",
            lastSeenAt: new Date(),
        };

        if (typeof playingPlaylistIdValue === "string") {
            updateData.playingPlaylistId = playingPlaylistIdValue || null;
        }

        if (typeof currentContentNameValue === "string") {
            updateData.currentContentName = currentContentNameValue || null;
        }

        if (cpuTempValue !== null) {
            updateData.cpuTemp = cpuTempValue;
            updateData.cpuTempUpdatedAt = new Date();
        }

        if (previewFile instanceof File) {
            // Keep heartbeat/liveness deterministic: preview uploads belong to /api/device/preview.
            if (!previewFile.type.startsWith("image/")) {
                console.warn(`[DEVICE_HEARTBEAT_POST] Ignoring non-image preview (${previewFile.type}) for device ${device.id}`);
            } else if (previewFile.size > MAX_DEVICE_PREVIEW_SIZE_BYTES) {
                console.warn(`[DEVICE_HEARTBEAT_POST] Ignoring oversized preview (${previewFile.size} bytes) for device ${device.id}`);
            } else {
                console.warn(`[DEVICE_HEARTBEAT_POST] Ignoring preview upload on heartbeat for device ${device.id}; use /api/device/preview`);
            }
        }

        await prisma.device.update({
            where: { id: device.id },
            data: updateData,
        });

        await persistDeviceSyncRuntime(device.id, syncRuntime);
        const hasActiveSyncAssignment =
            Array.isArray(device.syncSessionDevices) && device.syncSessionDevices.length > 0;
        const rejoinBudgetMs = parsePositiveIntegerEnv("DEVICE_HEARTBEAT_REJOIN_BUDGET_MS", DEFAULT_REJOIN_BUDGET_MS);
        const reelectionBudgetMs = parsePositiveIntegerEnv("DEVICE_HEARTBEAT_REELECTION_BUDGET_MS", DEFAULT_REELECTION_BUDGET_MS);

        if (!syncRuntime?.sessionId && hasActiveSyncAssignment) {
            await runBestEffortWithBudget(
                "SYNC_DEVICE_REJOIN",
                rejoinBudgetMs,
                () => maybeQueueSyncRejoinPrepareOnHeartbeat(device.id)
            );
        }
        if (syncRuntime?.sessionId) {
            const sessionId = syncRuntime.sessionId;
            const nowMs = Date.now();
            if (shouldRunMasterReelection(sessionId, nowMs)) {
                await runBestEffortWithBudget(
                    "SYNC_MASTER_FAILOVER",
                    reelectionBudgetMs,
                    () => maybeReelectMasterForSession(sessionId)
                );
            }
        }

        const response = NextResponse.json({ success: true });
        if (previewFile instanceof File) {
            response.headers.set("X-Use-Preview-Endpoint", "/api/device/preview");
        }
        return response;
    } catch (error) {
        console.error("[DEVICE_HEARTBEAT_POST]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
