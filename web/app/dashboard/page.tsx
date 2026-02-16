import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Monitor, HardDrive, PlaySquare } from "lucide-react";
import DevicePreviewGrid from "@/components/dashboard/device-preview-grid";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) return null;

    const [deviceCount, mediaCount, playlistCount, previewDevices] = await Promise.all([
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
                previewImageUrl: true,
                previewCapturedAt: true,
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
    ]);

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
                previewCapturedAt: device.previewCapturedAt ? device.previewCapturedAt.toISOString() : null,
            }))} />
        </div>
    );
}
