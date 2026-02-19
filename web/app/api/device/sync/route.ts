/* eslint-disable */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractSyncRuntimeFromJson, persistDeviceSyncRuntime } from "@/lib/sync-runtime-service";
import { DIRECTIVE_TAB } from "@/lib/directive-tabs";

export const dynamic = 'force-dynamic';

// Force redeploy for sync fix
export async function POST(request: Request) {
    try {
        const json = await request.json();
        const { device_token, playing_playlist_id } = json;
        const syncRuntime = extractSyncRuntimeFromJson(json);

        if (!device_token || typeof device_token !== "string") {
            return NextResponse.json(
                { error: "device_token is required" },
                { status: 400 }
            );
        }

        // Rate Limit Check
        const { checkRateLimit } = await import("@/lib/rate-limit");
        const isAllowed = await checkRateLimit(device_token, "device_sync");
        if (!isAllowed) {
            return NextResponse.json(
                { error: "Too many requests" },
                { status: 429 }
            );
        }



        // Find device by token
        const device = await prisma.device.findUnique({
            where: { token: device_token },
            include: {
                user: {
                    select: { isActive: true, activeDirectiveTab: true }
                },
                // Include Schedule and its relations
                schedule: {
                    include: {
                        items: {
                            include: {
                                playlist: {
                                    include: {
                                        items: {
                                            include: { mediaItem: true },
                                            orderBy: { order: "asc" },
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                // Include Default Playlist
                defaultPlaylist: {
                    include: {
                        items: {
                            include: { mediaItem: true },
                            orderBy: { order: "asc" },
                        }
                    }
                },
                // Keep legacy Active Playlist for now
                activePlaylist: {
                    include: {
                        items: {
                            include: { mediaItem: true },
                            orderBy: { order: "asc" },
                        }
                    }
                }
            },
        });



        if (!device) {
            return NextResponse.json(
                { error: "Invalid device token" },
                { status: 401 }
            );
        }

        // Check if user is active
        if (device.user && !device.user.isActive) {
            console.warn(`[SYNC API] Blocked sync for device ${device.id} (User Inactive)`);
            return NextResponse.json(
                { error: "Account suspended" },
                { status: 403 }
            );
        }

        // Update device status and last seen
        // Force cast to any to avoid Prisma type errors during build
        const updateData: any = {
            status: "online",
            lastSeenAt: new Date(),
            playingPlaylistId: playing_playlist_id ?? undefined,
        };

        await prisma.device.update({
            where: { id: device.id },
            data: updateData,
        });

        await persistDeviceSyncRuntime(device.id, syncRuntime);

        // Helper to format a playlist
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        const formatPlaylist = (playlist: any) => {
            if (!playlist) return null;
            console.log(`[SYNC API] Formatting Playlist ${playlist.id} (${playlist.name})`);
            console.log(`[SYNC API] Playlist Orientation: ${playlist.orientation}`);
            return {
                id: playlist.id,
                name: playlist.name,
                orientation: playlist.orientation, // Include top-level orientation
                items: playlist.items.map((item: any) => {
                    const rawDuration = item.duration;
                    const mediaDuration = item.mediaItem.duration;
                    const finalDuration = item.mediaItem.type === 'video' ? (mediaDuration || 0) : (rawDuration || 10);

                    console.log(`[SYNC API] Item ${item.id} (${item.mediaItem.type}):`);
                    console.log(`  - PlaylistItem.duration (from DB): ${rawDuration}`);
                    console.log(`  - MediaItem.duration: ${mediaDuration}`);
                    console.log(`  - Final duration sent to player: ${finalDuration}`);

                    return {
                        id: item.id,
                        type: item.mediaItem.type,
                        filename: item.mediaItem.filename || `file-${item.mediaItem.id}`,
                        url: item.mediaItem.url.startsWith("http")
                            ? item.mediaItem.url
                            : `${baseUrl}/api/media/download/${item.mediaItem.id}?token=${device_token}`,
                        order: item.order,
                        duration: finalDuration,
                        // Always use playlist orientation default
                        orientation: playlist.orientation || 'landscape',
                        name: item.mediaItem.name,
                    };
                }),
            };
        };

        const isSyncVideowallDirectiveActive =
            device.user?.activeDirectiveTab === DIRECTIVE_TAB.SYNC_VIDEOWALL;

        const schedulePayload = isSyncVideowallDirectiveActive
            ? null
            : device.schedule
                ? {
                    id: device.schedule.id,
                    name: device.schedule.name,
                    items: device.schedule.items.map((item) => ({
                        dayOfWeek: item.dayOfWeek,
                        startTime: item.startTime,
                        endTime: item.endTime,
                        playlist: formatPlaylist(item.playlist)
                    }))
                }
                : null;

        const defaultPlaylistPayload = isSyncVideowallDirectiveActive
            ? null
            : formatPlaylist(device.defaultPlaylist);

        const legacyPlaylistPayload = isSyncVideowallDirectiveActive
            ? null
            : formatPlaylist(device.activePlaylist || device.defaultPlaylist);

        // Construct Response
        const responsePayload = {
            _debug_version: "1.0.4",
            device_id: device.id,
            device_name: device.name,
            // Legacy field (deprecated but useful for fallback)
            playlist: legacyPlaylistPayload,

            // New Scheduling Fields
            schedule: schedulePayload,

            default_playlist: defaultPlaylistPayload
        };

        return NextResponse.json(responsePayload);
    } catch (error) {
        console.error("Sync API error:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
            },
            { status: 500 }
        );
    }
}
