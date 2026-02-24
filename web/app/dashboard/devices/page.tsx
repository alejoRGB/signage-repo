import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DeviceManager from "./device-manager";
import { getDeviceConnectivityStatus } from "@/lib/device-connectivity";
import { resolveLatestDeviceCpuTelemetry } from "@/lib/device-cpu-telemetry";

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
            schedule: {
                select: {
                    id: true,
                    name: true,
                },
            },
            syncSessionDevices: {
                where: {
                    cpuTemp: {
                        not: null,
                    },
                },
                select: {
                    cpuTemp: true,
                    updatedAt: true,
                },
                orderBy: {
                    updatedAt: "desc",
                },
                take: 1,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    // Transform devices to ensure name is string, dates are strings, and calculate status
    const formattedDevices = devices.map(d => {
        const { syncSessionDevices, ...deviceBase } = d;
        const status = getDeviceConnectivityStatus(d.lastSeenAt);

        const latestRuntime = syncSessionDevices[0] ?? null;
        const telemetry = resolveLatestDeviceCpuTelemetry(d, latestRuntime);
        return {
            ...deviceBase,
            name: d.name || "Unknown Device",
            status: d.status,
            connectivityStatus: status,
            lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
            cpuTemp: telemetry.cpuTemp,
            cpuTempUpdatedAt: telemetry.cpuTempUpdatedAt,
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
