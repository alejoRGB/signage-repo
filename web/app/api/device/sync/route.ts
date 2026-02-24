import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DIRECTIVE_TAB } from "@/lib/directive-tabs";
import { rateLimitKeyForDeviceToken } from "@/lib/rate-limit-key";
import { extractSyncRuntimeFromJson, persistDeviceSyncRuntime } from "@/lib/sync-runtime-service";

export const dynamic = "force-dynamic";

type SyncRequestPayload = Record<string, unknown>;

type MediaItemRecord = {
    id: string;
    type: string;
    url: string;
    name: string;
    filename: string | null;
    duration: number | null;
};

type PlaylistItemRecord = {
    id: string;
    order: number;
    duration: number | null;
    mediaItem: MediaItemRecord;
};

type PlaylistRecord = {
    id: string;
    name: string;
    orientation: string | null;
    items: PlaylistItemRecord[];
};

type ScheduleItemRecord = {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    playlist: PlaylistRecord | null;
};

type ScheduleRecord = {
    id: string;
    name: string;
    items: ScheduleItemRecord[];
};

type FormattedPlaylistItem = {
    id: string;
    type: string;
    filename: string;
    url: string;
    order: number;
    duration: number;
    orientation: string;
    name: string;
};

type FormattedPlaylist = {
    id: string;
    name: string;
    orientation: string | null;
    items: FormattedPlaylistItem[];
};

type DeviceSyncResponse = {
    device_id: string;
    device_name: string;
    playlist: FormattedPlaylist | null;
    schedule:
        | {
              id: string;
              name: string;
              items: Array<{
                  dayOfWeek: number;
                  startTime: string;
                  endTime: string;
                  playlist: FormattedPlaylist | null;
              }>;
          }
        | null;
    default_playlist: FormattedPlaylist | null;
};

const deviceSyncInclude = {
    user: {
        select: { isActive: true, activeDirectiveTab: true },
    },
    schedule: {
        include: {
            items: {
                include: {
                    playlist: {
                        include: {
                            items: {
                                include: { mediaItem: true },
                                orderBy: { order: "asc" },
                            },
                        },
                    },
                },
            },
        },
    },
    defaultPlaylist: {
        include: {
            items: {
                include: { mediaItem: true },
                orderBy: { order: "asc" },
            },
        },
    },
    activePlaylist: {
        include: {
            items: {
                include: { mediaItem: true },
                orderBy: { order: "asc" },
            },
        },
    },
} satisfies Prisma.DeviceInclude;

function isRecord(value: unknown): value is SyncRequestPayload {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatPlaylist(
    playlist: PlaylistRecord | null,
    baseUrl: string
): FormattedPlaylist | null {
    if (!playlist) {
        return null;
    }

    return {
        id: playlist.id,
        name: playlist.name,
        orientation: playlist.orientation,
        items: playlist.items.map((item) => {
            const rawDuration = item.duration;
            const mediaDuration = item.mediaItem.duration;
            const finalDuration =
                item.mediaItem.type === "video" ? (mediaDuration ?? 0) : (rawDuration ?? 10);

            return {
                id: item.id,
                type: item.mediaItem.type,
                filename: item.mediaItem.filename ?? `file-${item.mediaItem.id}`,
                url: item.mediaItem.url.startsWith("http")
                    ? item.mediaItem.url
                    : `${baseUrl}/api/media/download/${item.mediaItem.id}`,
                order: item.order,
                duration: finalDuration,
                orientation: playlist.orientation ?? "landscape",
                name: item.mediaItem.name,
            };
        }),
    };
}

export async function POST(request: Request) {
    try {
        const rawPayload: unknown = await request.json();
        if (!isRecord(rawPayload)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const deviceToken = rawPayload.device_token;
        const playingPlaylistId = rawPayload.playing_playlist_id;
        const syncRuntime = extractSyncRuntimeFromJson(rawPayload);

        if (typeof deviceToken !== "string" || !deviceToken) {
            return NextResponse.json({ error: "device_token is required" }, { status: 400 });
        }

        const { checkRateLimit } = await import("@/lib/rate-limit");
        const isAllowed = await checkRateLimit(rateLimitKeyForDeviceToken(deviceToken), "device_sync");
        if (!isAllowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const device = await prisma.device.findUnique({
            where: { token: deviceToken },
            include: deviceSyncInclude,
        });

        if (!device) {
            return NextResponse.json({ error: "Invalid device token" }, { status: 401 });
        }

        if (device.user && !device.user.isActive) {
            console.warn(`[SYNC API] Blocked sync for device ${device.id} (User Inactive)`);
            return NextResponse.json({ error: "Account suspended" }, { status: 403 });
        }

        const nextPlayingPlaylistId =
            typeof playingPlaylistId === "string" ? (playingPlaylistId || null) : undefined;
        const updateData: Prisma.DeviceUncheckedUpdateInput | null =
            nextPlayingPlaylistId === undefined ? null : { playingPlaylistId: nextPlayingPlaylistId };

        if (updateData) {
            await prisma.device.update({
                where: { id: device.id },
                data: updateData,
            });
        }

        await persistDeviceSyncRuntime(device.id, syncRuntime);

        const requestOrigin = new URL(request.url).origin;
        const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || requestOrigin).replace(/\/$/, "");

        const isSyncVideowallDirectiveActive =
            device.user?.activeDirectiveTab === DIRECTIVE_TAB.SYNC_VIDEOWALL;

        const scheduleRecord = device.schedule as ScheduleRecord | null;
        const defaultPlaylistRecord = device.defaultPlaylist as PlaylistRecord | null;
        const activePlaylistRecord = device.activePlaylist as PlaylistRecord | null;

        const schedulePayload: DeviceSyncResponse["schedule"] = isSyncVideowallDirectiveActive
            ? null
            : scheduleRecord
              ? {
                    id: scheduleRecord.id,
                    name: scheduleRecord.name,
                    items: scheduleRecord.items.map((item) => ({
                        dayOfWeek: item.dayOfWeek,
                        startTime: item.startTime,
                        endTime: item.endTime,
                        playlist: formatPlaylist(item.playlist, baseUrl),
                    })),
                }
              : null;

        const defaultPlaylistPayload = isSyncVideowallDirectiveActive
            ? null
            : formatPlaylist(defaultPlaylistRecord, baseUrl);

        const legacyPlaylistPayload = isSyncVideowallDirectiveActive
            ? null
            : formatPlaylist(activePlaylistRecord ?? defaultPlaylistRecord, baseUrl);

        const responsePayload: DeviceSyncResponse = {
            device_id: device.id,
            device_name: device.name ?? "Unnamed Device",
            playlist: legacyPlaylistPayload,
            schedule: schedulePayload,
            default_playlist: defaultPlaylistPayload,
        };

        return NextResponse.json(responsePayload);
    } catch (error) {
        console.error("Sync API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
