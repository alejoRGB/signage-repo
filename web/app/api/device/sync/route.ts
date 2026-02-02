import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const { device_token } = json;

        if (!device_token || typeof device_token !== "string") {
            return NextResponse.json(
                { error: "device_token is required" },
                { status: 400 }
            );
        }



        // Find device by token
        const device = await prisma.device.findUnique({
            where: { token: device_token },
            include: {
                user: {
                    select: { isActive: true }
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
        await prisma.device.update({
            where: { id: device.id },
            data: {
                status: "online",
                lastSeenAt: new Date(),
            },
        });

        // Helper to format a playlist
        const protocol = request.headers.get("x-forwarded-proto") || "http";
        const host = request.headers.get("host") || "localhost:3000";
        const baseUrl = `${protocol}://${host}`;

        const formatPlaylist = (playlist: any) => {
            if (!playlist) return null;
            return {
                id: playlist.id,
                name: playlist.name,
                items: playlist.items.map((item: any) => ({
                    id: item.id,
                    type: item.mediaItem.type,
                    filename: item.mediaItem.filename || `file-${item.mediaItem.id}`,
                    url: item.mediaItem.url.startsWith("http")
                        ? item.mediaItem.url
                        : `${baseUrl}/api/media/download/${item.mediaItem.id}?token=${device_token}`,
                    order: item.order,
                    order: item.order,
                    duration: item.mediaItem.type === 'video' ? (item.mediaItem.duration || 0) : (item.duration || 10),
                    orientation: item.mediaItem.orientation || 'landscape',
                    name: item.mediaItem.name, // Added for debugging
                })),
            };
        };

        // Construct Response
        const responsePayload = {
            device_id: device.id,
            device_name: device.name,
            // Legacy field (deprecated but useful for fallback)
            playlist: formatPlaylist(device.activePlaylist || device.defaultPlaylist),

            // New Scheduling Fields
            schedule: device.schedule ? {
                id: device.schedule.id,
                name: device.schedule.name,
                items: device.schedule.items.map((item) => ({
                    dayOfWeek: item.dayOfWeek,
                    startTime: item.startTime,
                    endTime: item.endTime,
                    playlist: formatPlaylist(item.playlist)
                }))
            } : null,

            default_playlist: formatPlaylist(device.defaultPlaylist)
        };

        return NextResponse.json(responsePayload);
    } catch (error: any) {
        console.error("Sync API error:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                details: error?.message || String(error),
                stack: error?.stack
            },
            { status: 500 }
        );
    }
}
