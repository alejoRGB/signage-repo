"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, PlaySquare, Trash2, Edit } from "lucide-react";
import Link from "next/link";
import ConfirmModal from "@/components/confirm-modal";

type Playlist = {
    id: string;
    name: string;
    _count: { items: number };
    createdAt: Date;
};

export default function PlaylistList({ initialPlaylists }: { initialPlaylists: Playlist[] }) {
    const router = useRouter();
    const [creating, setCreating] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState("");

    const [deleteId, setDeleteId] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPlaylistName) return;

        try {
            const res = await fetch("/api/playlists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newPlaylistName }),
            });

            if (!res.ok) throw new Error("Failed to create");

            setNewPlaylistName("");
            setCreating(false);
            router.refresh();
        } catch (error) {
            alert("Error creating playlist");
        }
    };

    const confirmDelete = async () => {
        if (!deleteId) return;

        try {
            await fetch(`/api/playlists/${deleteId}`, {
                method: "DELETE",
            });
            router.refresh();
        } catch (error) {
            alert("Error deleting");
        } finally {
            setDeleteId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow">
                <h2 className="text-lg font-medium text-gray-900">Your Playlists</h2>
                <button
                    onClick={() => setCreating(!creating)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                    <Plus className="h-4 w-4 mr-2" /> New Playlist
                </button>
            </div>

            {creating && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <form onSubmit={handleCreate} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Playlist Name"
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                        >
                            Save
                        </button>
                        <button
                            type="button"
                            onClick={() => setCreating(false)}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}

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
                            <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow border border-gray-200 group">
                                <div className="px-4 py-5 sm:p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                                                <PlaySquare className="h-6 w-6 text-indigo-600" />
                                            </div>
                                            <div className="ml-4">
                                                <h3 className="text-lg font-medium leading-6 text-gray-900 group-hover:text-indigo-600 transition-colors">
                                                    {playlist.name}
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    {playlist._count.items} items
                                                </p>
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
                                </div>
                                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                                    <div className="text-sm text-gray-500">
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
