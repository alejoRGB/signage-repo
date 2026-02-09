"use client";

import { useState } from "react";
import { X, Globe, Image as ImageIcon, Layout, Monitor } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";

type CreatePlaylistDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
};

export default function CreatePlaylistDialog({ isOpen, onClose, onSuccess }: CreatePlaylistDialogProps) {
    const { showToast } = useToast();
    const [name, setName] = useState("");
    const [type, setType] = useState<"media" | "web">("media");
    const [orientation, setOrientation] = useState<"landscape" | "portrait" | "portrait-270">("landscape");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/playlists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    type,
                    orientation: type === 'web' ? orientation : 'landscape'
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create playlist");
            }

            // Reset and close
            setName("");
            setType("media");
            setOrientation("landscape");
            onSuccess();
            onClose();
            showToast("Playlist created successfully", "success");
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-lg font-semibold text-gray-900">Create New Playlist</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Name Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Playlist Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-900"
                            placeholder="e.g. Lobby Morning Loop"
                        />
                    </div>

                    {/* Type Selector */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">Content Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setType("media")}
                                className={`relative flex flex-col items-center justify-center p-4 border rounded-xl transition-all duration-200 ${type === "media"
                                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600"
                                    : "border-gray-200 hover:border-indigo-200 hover:bg-gray-50 text-gray-600"
                                    }`}
                            >
                                <ImageIcon className="w-6 h-6 mb-2" />
                                <span className="text-sm font-medium">Media</span>
                                <span className="text-xs opacity-75">Video & Images</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setType("web")}
                                className={`relative flex flex-col items-center justify-center p-4 border rounded-xl transition-all duration-200 ${type === "web"
                                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600"
                                    : "border-gray-200 hover:border-indigo-200 hover:bg-gray-50 text-gray-600"
                                    }`}
                            >
                                <Globe className="w-6 h-6 mb-2" />
                                <span className="text-sm font-medium">Web Pages</span>
                                <span className="text-xs opacity-75">Websites & Dashboards</span>
                            </button>
                        </div>
                    </div>

                    {/* Orientation Selector (Only for Web) */}
                    {type === "web" && (
                        <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                            <label className="text-sm font-medium text-gray-700">Screen Orientation</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: "landscape", label: "Landscape", icon: Layout },
                                    { id: "portrait", label: "Portrait", icon: Monitor, className: "-rotate-90" },
                                    { id: "portrait-270", label: "Portrait 270", icon: Monitor, className: "rotate-90" },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setOrientation(opt.id as any)}
                                        className={`flex flex-col items-center justify-center p-3 border rounded-lg text-center transition-all ${orientation === opt.id
                                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                                            }`}
                                    >
                                        <opt.icon className={`w-5 h-5 mb-1 ${opt.className || ""}`} />
                                        <span className="text-xs font-medium">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500">
                                This will rotate the physical screen when this playlist starts.
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Creating..." : "Create Playlist"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
