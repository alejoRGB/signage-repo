"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, PlaySquare, Trash2, Edit, Video, Globe, ChevronDown, ChevronUp, Clock, FileImage, Layout } from "lucide-react";
import Link from "next/link";
import ConfirmModal from "@/components/confirm-modal";
import CreatePlaylistDialog from "@/components/playlists/create-playlist-dialog";
import { useToast } from "@/components/ui/toast-context";

type MediaItem = {
    id: string;
    name: string;
    type: string;
    url: string;
    duration: number | null;
};

type PlaylistItem = {
    id: string;
    order: number;
    duration: number;
    mediaItem: MediaItem;
};

type Playlist = {
    id: string;
    name: string;
    type: "media" | "web";
    orientation: string;
    items: PlaylistItem[];
    _count: { items: number };
    createdAt: Date;
};

export default function PlaylistList({ initialPlaylists }: { initialPlaylists: Playlist[] }) {
    const router = useRouter();
    const { showToast } = useToast();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

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

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        setExpandedId(expandedId === id ? null : id);
    };

    const calculateTotalDuration = (items: PlaylistItem[]) => {
        const totalSeconds = items.reduce((acc, item) => acc + (item.duration || item.mediaItem.duration || 10), 0);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}m ${seconds}s`;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-card p-4 rounded-lg border border-border">
                <h2 className="text-lg font-medium text-foreground">Your Playlists</h2>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-lg shadow-primary/20 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-all hover:scale-105"
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
                <div className="text-center py-12 bg-card rounded-lg border-2 border-dashed border-border">
                    <PlaySquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">No playlists</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Create a playlist to organize your content.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {initialPlaylists.map((playlist) => (
                        <div
                            key={playlist.id}
                            className={`bg-card border border-border rounded-lg overflow-hidden transition-all duration-300 ${expandedId === playlist.id ? 'ring-1 ring-primary/50 shadow-lg shadow-primary/5' : 'hover:border-primary/30'}`}
                        >
                            <div className="px-4 py-4 sm:px-6 cursor-pointer" onClick={(e) => toggleExpand(playlist.id, e)}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center min-w-0 gap-4">
                                        <div className={`flex-shrink-0 rounded-md p-2.5 ${playlist.type === 'web' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                            {playlist.type === 'web' ? <Globe className="h-5 w-5" /> : <PlaySquare className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <h3 className="text-base font-semibold text-foreground truncate">{playlist.name}</h3>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Layout className="h-3 w-3" />
                                                    {playlist._count.items} items
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {calculateTotalDuration(playlist.items)}
                                                </span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${playlist.type === 'web' ? 'bg-purple-500/5 text-purple-400 border-purple-500/20' : 'bg-blue-500/5 text-blue-400 border-blue-500/20'}`}>
                                                    {playlist.type}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteId(playlist.id);
                                            }}
                                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                                            role="button"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </div>
                                        <Link
                                            href={`/dashboard/playlists/${playlist.id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Link>
                                        <div className="p-2 text-muted-foreground">
                                            {expandedId === playlist.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {expandedId === playlist.id && (
                                <div className="border-t border-border bg-black/20 px-4 py-3 sm:px-6">
                                    <div className="space-y-2">
                                        {playlist.items.length === 0 ? (
                                            <p className="text-sm text-muted-foreground italic text-center py-2">No items in this playlist.</p>
                                        ) : (
                                            playlist.items.map((item, index) => (
                                                <div key={item.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-white/5 transition-colors">
                                                    <span className="text-muted-foreground/50 font-mono text-xs w-6 text-center">{index + 1}</span>
                                                    <div className="h-8 w-14 bg-black/40 rounded overflow-hidden flex-shrink-0 flex items-center justify-center border border-white/5">
                                                        {item.mediaItem.type === 'video' ? <Video className="h-4 w-4 text-muted-foreground" /> :
                                                            item.mediaItem.type === 'image' ? <FileImage className="h-4 w-4 text-muted-foreground" /> :
                                                                <Globe className="h-4 w-4 text-muted-foreground" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-foreground truncate">{item.mediaItem.name}</p>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-mono">
                                                        {item.duration || item.mediaItem.duration}s
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        <div className="pt-2 flex justify-center">
                                            <Link
                                                href={`/dashboard/playlists/${playlist.id}`}
                                                className="text-xs text-primary hover:text-primary/80 font-medium"
                                            >
                                                Manage Playlist Items &rarr;
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
