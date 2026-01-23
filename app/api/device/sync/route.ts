import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

        console.log("[SYNC API] Looking for device with token:", device_token);

        // Find device by token
        const device = await prisma.device.findUnique({
            where: { token: device_token },
            include: {
                activePlaylist: {
                    include: {
                        items: {
                            include: {
                                mediaItem: true,
                            },
                            orderBy: {
                                order: "asc",
                            },
                        },
                    },
                },
            },
        });

        console.log("[SYNC API] Device found:", device ? `Yes (${device.id})` : "No");

        if (!device) {
            return NextResponse.json(
                { error: "Invalid device token" },
                { status: 401 }
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

        // If no playlist assigned, return empty playlist
        if (!device.activePlaylist) {
            return NextResponse.json({
                device_id: device.id,
                device_name: device.name,
                playlist: null,
            });
        }

        // Build playlist response with download URLs
        // Use the request headers to determine the host so it works from external devices
        const protocol = request.headers.get("x-forwarded-proto") || "http";
        const host = request.headers.get("host") || "localhost:3000";
        const baseUrl = `${protocol}://${host}`;
        const playlistData = {
            id: device.activePlaylist.id,
            name: device.activePlaylist.name,
            items: device.activePlaylist.items.map((item) => ({
                id: item.id,
                type: item.mediaItem.type,
                filename: item.mediaItem.filename,
                url: `${baseUrl}/api/media/download/${item.mediaItem.id}?token=${device_token}`,
                order: item.order,
                // Include duration for images (videos have their own duration)
                ...(item.mediaItem.type === "image" && {
                    duration: item.mediaItem.duration || 10,
                }),
            })),
        };

        return NextResponse.json({
            device_id: device.id,
            device_name: device.name,
            playlist: playlistData,
        });
    } catch (error) {
        console.error("Sync API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
