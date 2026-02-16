import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Monitor, HardDrive, PlaySquare } from "lucide-react";
import DevicePreviewGrid from "@/components/dashboard/device-preview-grid";

const ONLINE_STALE_MS = 5 * 60_000;

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) return null;

    const [deviceCount, mediaCount, playlistCount, previewDevices, mediaItems] = await Promise.all([
        prisma.device.count({ where: { userId: session.user.id } }),
        prisma.mediaItem.count({ where: { userId: session.user.id } }),
        prisma.playlist.count({ where: { userId: session.user.id } }),
        prisma.device.findMany({
            where: { userId: session.user.id },
            select: {
                id: true,
                name: true,
                createdAt: true,
                lastSeenAt: true,
                currentContentName: true,
                activePlaylist: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                playingPlaylist: {
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
            },
            orderBy: {
                createdAt: "asc",
            },
        }),
        prisma.mediaItem.findMany({
            where: { userId: session.user.id },
            select: {
                name: true,
                filename: true,
                type: true,
                url: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        }),
    ]);

    const mediaByFilename = new Map<string, { type: string; url: string; name: string }>();
    const mediaByName = new Map<string, { type: string; url: string; name: string }>();
    for (const media of mediaItems) {
        const preview = { type: media.type, url: media.url, name: media.name };
        if (media.filename && !mediaByFilename.has(media.filename)) {
            mediaByFilename.set(media.filename, preview);
        }
        if (!mediaByName.has(media.name)) {
            mediaByName.set(media.name, preview);
        }
    }

    const stats = [
        { name: 'Total Devices', value: deviceCount, icon: Monitor, color: 'bg-blue-500' },
        { name: 'Media Items', value: mediaCount, icon: HardDrive, color: 'bg-green-500' },
        { name: 'Active Playlists', value: playlistCount, icon: PlaySquare, color: 'bg-purple-500' },
    ];

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Welcome back, {session.user.name}</p>

            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {stats.map((item) => (
                    <div key={item.name} className="overflow-hidden rounded-lg bg-white shadow">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-md ${item.color} text-white`}>
                                        <item.icon className="h-6 w-6" aria-hidden="true" />
                                    </div>
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                    <dl>
                                        <dt className="truncate text-sm font-medium text-gray-500">{item.name}</dt>
                                        <dd>
                                            <div className="text-lg font-medium text-gray-900">{item.value}</div>
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <DevicePreviewGrid initialDevices={previewDevices.map((device) => ({
                ...device,
                createdAt: device.createdAt.toISOString(),
                lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
                connectivityStatus: device.lastSeenAt && (Date.now() - device.lastSeenAt.getTime()) < ONLINE_STALE_MS ? "online" : "offline",
                contentPreview: device.currentContentName
                    ? mediaByFilename.get(device.currentContentName) ?? mediaByName.get(device.currentContentName) ?? null
                    : null,
            }))} />
        </div>
    );
}
