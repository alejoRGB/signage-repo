import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { type SyncDeviceCommandType } from "@/types/sync";

type PrepareMedia = {
    mediaId: string;
    filename: string | null;
    width: number | null;
    height: number | null;
    fps: number | null;
};

type PrepareCommandInput = {
    sessionId: string;
    presetId: string;
    mode: "COMMON" | "PER_DEVICE";
    startAtMs: number;
    durationMs: number;
    deviceId: string;
    masterDeviceId?: string | null;
    failoverFromDeviceId?: string | null;
    electionAtMs?: number | null;
    media: PrepareMedia;
};

function mediaResolutionLabel(width: number | null, height: number | null) {
    if (!width || !height) {
        return null;
    }
    return `${width}x${height}`;
}

function mediaLocalPath(filename: string | null) {
    if (!filename) {
        return "";
    }

    // Keep payload path portable; player resolves against its configured media_dir.
    return filename;
}

function envBoolean(name: string, defaultValue: boolean) {
    const raw = process.env[name];
    if (!raw) {
        return defaultValue;
    }
    const normalized = raw.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return defaultValue;
}

function envNumber(name: string, defaultValue: number, minimum: number) {
    const raw = process.env[name];
    if (!raw) {
        return defaultValue;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        return defaultValue;
    }
    return Math.max(minimum, parsed);
}

export function buildPreparePayload(input: PrepareCommandInput) {
    const lanEnabled = envBoolean("SYNC_LAN_ENABLED", false);
    const lanBeaconHz = envNumber("SYNC_LAN_BEACON_HZ", 20, 1);
    const lanBeaconPort = envNumber("SYNC_LAN_BEACON_PORT", 39051, 1024);
    const lanTimeoutMs = envNumber("SYNC_LAN_TIMEOUT_MS", 1500, 250);
    const lanFallbackToCloud = envBoolean("SYNC_LAN_FALLBACK_TO_CLOUD", true);

    return JSON.parse(
        JSON.stringify({
        type: "sync.prepare",
        session_id: input.sessionId,
        preset_id: input.presetId,
        start_at_ms: input.startAtMs,
        duration_ms: input.durationMs,
        master_device_id: input.masterDeviceId ?? undefined,
        target_device_id: input.deviceId,
        failover: input.failoverFromDeviceId
            ? {
                  from_device_id: input.failoverFromDeviceId,
                  elected_at_ms: input.electionAtMs ?? Date.now(),
              }
            : undefined,
        media: {
            mode: input.mode === "COMMON" ? "common" : "per_device",
            media_id: input.media.mediaId,
            local_path: mediaLocalPath(input.media.filename),
            resolution: mediaResolutionLabel(input.media.width, input.media.height),
            fps: input.media.fps ?? undefined,
            codec: "h264",
        },
        sync_config: {
            hard_resync_threshold_ms: 500,
            soft_correction_range_ms: [25, 500],
            deadband_ms: 25,
            warmup_loops: 3,
            lan: {
                enabled: lanEnabled,
                beacon_hz: lanBeaconHz,
                beacon_port: lanBeaconPort,
                timeout_ms: lanTimeoutMs,
                fallback_to_cloud: lanFallbackToCloud,
            },
        },
        })
    ) as Prisma.InputJsonValue;
}

export function buildStopPayload(sessionId: string, reason: string) {
    return JSON.parse(
        JSON.stringify({
            type: "sync.stop",
            session_id: sessionId,
            reason: reason.toLowerCase(),
        })
    ) as Prisma.InputJsonValue;
}

export async function enqueueSyncCommands(
    commands: Array<{
        deviceId: string;
        sessionId: string;
        type: SyncDeviceCommandType;
        payload: Prisma.InputJsonValue;
        dedupeKey: string;
    }>
) {
    if (commands.length === 0) {
        return { count: 0 };
    }

    return prisma.syncDeviceCommand.createMany({
        data: commands.map((command) => ({
            deviceId: command.deviceId,
            sessionId: command.sessionId,
            type: command.type,
            payload: command.payload,
            dedupeKey: command.dedupeKey,
            status: "PENDING",
        })),
        skipDuplicates: true,
    });
}

export async function getDeviceByTokenForCommandFlow(deviceToken: string) {
    return prisma.device.findUnique({
        where: { token: deviceToken },
        include: {
            user: {
                select: { isActive: true },
            },
        },
    });
}
