import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DeviceManager from "./device-manager";

export const metadata = {
    title: "Devices | Cloud Signage",
};

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

    // Transform devices to ensure name is string and dates are strings
    const formattedDevices = devices.map(d => ({
        ...d,
        name: d.name || "Unknown Device",
        lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        activePlaylist: d.activePlaylist ? {
            ...d.activePlaylist,
            name: d.activePlaylist.name || "Unnamed Playlist"
        } : null
    }));

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
