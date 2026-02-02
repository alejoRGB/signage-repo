"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, ArrowUp, ArrowDown, Plus, Clock, Globe } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";

type MediaItem = {
    id: string;
    name: string;
    type: string;
    url: string;
    duration: number;
};

type PlaylistItem = {
    id?: string; // Optional for new items
    mediaItemId: string; // Match DB field
    duration: number;
    order: number;
    mediaItem: MediaItem;
};

type Playlist = {
    id: string;
    name: string;
    items: PlaylistItem[];
};

export default function PlaylistEditor({
    playlist,
    library,
}: {
    playlist: Playlist;
    library: MediaItem[];
}) {
    const router = useRouter();
    const { showToast } = useToast();
    const [items, setItems] = useState<PlaylistItem[]>(playlist.items);
    const [name, setName] = useState(playlist.name);
    const [saving, setSaving] = useState(false);


    const handleAddItem = (media: MediaItem) => {
        const newItem: PlaylistItem = {
            mediaItemId: media.id, // Match DB field
            duration: media.duration || 10, // Use media duration
            order: items.length,
            mediaItem: media,
        };
        setItems([...items, newItem]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        // Re-index order
        const reordered = newItems.map((item, i) => ({ ...item, order: i }));
        setItems(reordered);
    };

    const handleMove = (index: number, direction: "up" | "down") => {
        if (direction === "up" && index === 0) return;
        if (direction === "down" && index === items.length - 1) return;

        const newItems = [...items];
        const targetIndex = direction === "up" ? index - 1 : index + 1;

        // Swap
        [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];

        // Re-index
        const reordered = newItems.map((item, i) => ({ ...item, order: i }));
        setItems(reordered);
    };

    const handleDurationChange = (index: number, duration: number) => {
        const newItems = [...items];
        newItems[index].duration = duration;
        setItems(newItems);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/playlists/${playlist.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    items: items.map((item) => ({
                        mediaItemId: item.mediaItemId, // Send correct field
                        duration: item.duration,
                    })),
                }),
            });

            if (!res.ok) throw new Error("Failed to save");

            router.refresh();
            showToast("Playlist saved successfully!", "success");
        } catch (error) {
            console.error(error);
            showToast("Error saving playlist", "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-[calc(100vh-12rem)] flex flex-col sm:flex-row gap-6">
            {/* Left: Editor */}
            <div className="flex-1 flex flex-col bg-white shadow rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="text-lg font-medium text-gray-900 bg-transparent border-b border-gray-300 focus:border-indigo-500 focus:outline-none w-1/2"
                    />
                    <div className="text-sm text-gray-500">
                        {items.length} items • {items.reduce((acc, i) => acc + i.duration, 0)}s total
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-100">
                    {items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <p>Playlist is empty</p>
                            <p className="text-sm">Add items from the library on the right</p>
                        </div>
                    ) : (
                        items.map((item, index) => (
                            <div key={`${item.mediaItemId}-${index}`} className="flex items-center gap-4 bg-white p-3 rounded shadow-sm border border-gray-200">
                                <span className="text-gray-400 font-mono w-6 text-center">{index + 1}</span>

                                <div className="h-12 w-16 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                                    {item.mediaItem.type === 'video' ? (
                                        <video src={item.mediaItem.url} className="w-full h-full object-cover" />
                                    ) : item.mediaItem.type === 'web' ? (
                                        <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                                            <Globe className="h-6 w-6 text-indigo-400" />
                                        </div>
                                    ) : (
                                        <img src={item.mediaItem.url} alt={item.mediaItem.name} className="w-full h-full object-cover" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{item.mediaItem.name}</p>
                                    <p className="text-xs text-gray-500 uppercase">{item.mediaItem.type}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-400" />
                                    <Clock className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-gray-600 font-mono">{item.mediaItem.duration || item.duration}s</span>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button onClick={() => handleMove(index, 'up')} className="p-1 hover:bg-gray-100 rounded text-gray-500" disabled={index === 0}>
                                        <ArrowUp className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleMove(index, 'down')} className="p-1 hover:bg-gray-100 rounded text-gray-500" disabled={index === items.length - 1}>
                                        <ArrowDown className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleRemoveItem(index)} className="p-1 hover:bg-red-50 rounded text-red-500">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right: Library */}
            <div className="w-full sm:w-1/3 flex flex-col bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-medium text-gray-900">Media Library</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {library.map((media) => (
                        <div key={media.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 group cursor-pointer" onClick={() => handleAddItem(media)}>
                            <div className="h-10 w-14 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                                {media.type === 'video' ? (
                                    <video src={media.url} className="w-full h-full object-cover" />
                                ) : media.type === 'web' ? (
                                    <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                                        <Globe className="h-5 w-5 text-indigo-400" />
                                    </div>
                                ) : (
                                    <img src={media.url} alt={media.name} className="w-full h-full object-cover" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 truncate">{media.name}</p>
                            </div>
                            <button className="p-1 bg-indigo-50 text-indigo-600 rounded-full opacity-0 group-hover:opacity-100">
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    {library.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">No media available.</p>
                    )}
                </div>
            </div>
            {/* Toast Container removed */}

        </div >
    );
}
