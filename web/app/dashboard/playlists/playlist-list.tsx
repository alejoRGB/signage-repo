"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, PlaySquare, Trash2, Edit, Video, Globe } from "lucide-react";
import Link from "next/link";
import ConfirmModal from "@/components/confirm-modal";
import CreatePlaylistDialog from "@/components/playlists/create-playlist-dialog";
import { useToast } from "@/components/ui/toast-context";

type Playlist = {
    id: string;
    name: string;
    type: "media" | "web";
    orientation: string;
    _count: { items: number };
    createdAt: Date;
};

export default function PlaylistList({ initialPlaylists }: { initialPlaylists: Playlist[] }) {
    const router = useRouter();
    const { showToast } = useToast();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const handleCreateSuccess = () => {
        router.refresh();
    };

    const confirmDelete = async () => {
        if (!deleteId) return;

        try {
            await fetch(`/api/playlists/${deleteId}`, {
                method: "DELETE",
            });
            router.refresh();
        } catch (error) {
            showToast("Error deleting playlist", "error");
        } finally {
            setDeleteId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow">
                <h2 className="text-lg font-medium text-gray-900">Your Playlists</h2>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="h-4 w-4 mr-2" /> New Playlist
                </button>
            </div>

            <CreatePlaylistDialog
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={handleCreateSuccess}
            />

            <ConfirmModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={confirmDelete}
                title="Delete Playlist"
                message="Are you sure you want to delete this playlist? This action cannot be undone."
                confirmText="Delete"
                isDestructive={true}
            />

            {initialPlaylists.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                    <PlaySquare className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No playlists</h3>
                    <p className="mt-1 text-sm text-gray-500">Create a playlist to organize your content.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {initialPlaylists.map((playlist) => (
                        <Link
                            key={playlist.id}
                            href={`/dashboard/playlists/${playlist.id}`}
                            className="block hover:no-underline"
                        >
                            <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow border border-gray-200 group h-full flex flex-col">
                                <div className="px-4 py-5 sm:p-6 flex-1">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start">
                                            <div className={`flex-shrink-0 rounded-md p-3 ${playlist.type === 'web' ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                {playlist.type === 'web' ? <Globe className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                                            </div>
                                            <div className="ml-4">
                                                <h3 className="text-lg font-medium leading-6 text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                                                    {playlist.name}
                                                </h3>
                                                <div className="mt-1 flex flex-wrap gap-2">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                                                        {playlist.type}
                                                    </span>
                                                    {playlist.type === 'web' && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                                                            {playlist.orientation.replace('-', ' ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setDeleteId(playlist.id);
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <p className="mt-4 text-sm text-gray-500">
                                        {playlist._count.items} {playlist._count.items === 1 ? 'item' : 'items'}
                                    </p>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6">
                                    <div className="text-xs text-gray-400">
                                        Created {new Date(playlist.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
