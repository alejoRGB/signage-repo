
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HardDrive, Image as ImageIcon, Video, Globe, List, Calendar } from "lucide-react";
import ResetPasswordModal from "@/components/admin/reset-password-modal";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
        redirect("/admin/login");
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
        where: { id },
        include: {
            devices: true,
            playlists: true,
            schedules: true,
            media: true,
        }
    });

    if (!user) {
        return <div className="p-8">User not found</div>;
    }

    // Calculate Stats
    const totalStorage = user.media.reduce((acc, item) => acc + (item.size || 0), 0);
    const videoCount = user.media.filter(m => m.type === 'video').length;
    const imageCount = user.media.filter(m => m.type === 'image').length;
    const webCount = user.media.filter(m => m.type === 'web').length;

    // Format Bytes
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const weights = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + weights[i];
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6 flex items-center gap-4">
                <Link href="/admin" className="p-2 bg-white rounded-full shadow hover:bg-gray-50 text-gray-600">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{user.name || "No Name"}</h1>
                    <p className="text-gray-500">{user.email}</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <ResetPasswordModal userId={user.id} userName={user.name || "User"} />
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* Storage */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                            <HardDrive className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Storage</p>
                            <p className="text-2xl font-bold text-gray-900">{formatBytes(totalStorage)}</p>
                        </div>
                    </div>
                </div>

                {/* Media Types */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 md:col-span-2">
                    <h3 className="font-medium text-gray-900 mb-4">Content Breakdown</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-purple-50 rounded border border-purple-100">
                            <Video className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                            <span className="block text-2xl font-bold text-purple-900">{videoCount}</span>
                            <span className="text-xs text-purple-700">Videos</span>
                        </div>
                        <div className="text-center p-3 bg-amber-50 rounded border border-amber-100">
                            <ImageIcon className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                            <span className="block text-2xl font-bold text-amber-900">{imageCount}</span>
                            <span className="text-xs text-amber-700">Images</span>
                        </div>
                        <div className="text-center p-3 bg-sky-50 rounded border border-sky-100">
                            <Globe className="h-5 w-5 text-sky-600 mx-auto mb-1" />
                            <span className="block text-2xl font-bold text-sky-900">{webCount}</span>
                            <span className="text-xs text-sky-700">Webpages</span>
                        </div>
                    </div>
                </div>

                {/* Organization */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded">
                                <List className="h-5 w-5" />
                            </div>
                            <span className="text-gray-700 font-medium">Playlists</span>
                        </div>
                        <span className="text-2xl font-bold text-gray-900">{user.playlists.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <span className="text-gray-700 font-medium">Schedules</span>
                        </div>
                        <span className="text-2xl font-bold text-gray-900">{user.schedules.length}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
