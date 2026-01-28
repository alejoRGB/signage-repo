import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DeviceManager from "./device-manager";

export const metadata = {
    title: "Devices | Cloud Signage",
};

export const dynamic = "force-dynamic"; // Ensure fresh data on every request

export default async function DevicesPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    // Fetch devices
    const devices = await prisma.device.findMany({
        where: {
            userId: session.user.id,
        },
        include: {
            activePlaylist: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    // Transform devices to ensure name is string, dates are strings, and calculate status
    const formattedDevices = devices.map(d => {
        // Calculate dynamic status based on lastSeenAt
        let status = "offline";

        if (d.lastSeenAt) {
            const lastSeenTime = new Date(d.lastSeenAt).getTime();
            const now = Date.now();
            const thresholdInMs = 2 * 60 * 1000; // 2 minutes (Player pings every 60s)

            // Device is online if it checked in within the threshold
            if (now - lastSeenTime < thresholdInMs) {
                status = "online";
            }
        }

        return {
            ...d,
            name: d.name || "Unknown Device",
            status: d.status,
            connectivityStatus: status,
            lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
            activePlaylist: d.activePlaylist ? {
                ...d.activePlaylist,
                name: d.activePlaylist.name || "Unnamed Playlist"
            } : null
        };
    });

    // Fetch playlists for dropdown
    const playlists = await prisma.playlist.findMany({
        where: {
            userId: session.user.id,
        },
        select: {
            id: true,
            name: true,
        },
        orderBy: {
            name: "asc",
        },
    });

    return (
        <div className="space-y-6">
            <DeviceManager devices={formattedDevices} playlists={playlists} />
        </div>
    );
}
