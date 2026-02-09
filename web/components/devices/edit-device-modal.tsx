"use client";

import { useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { Device, Playlist } from "@/types/device";

// We need a Schedule type. Assuming it's simple for now.
type Schedule = {
    id: string;
    name: string;
};

type EditDeviceModalProps = {
    isOpen: boolean;
    device: Device | null;
    playlists: Playlist[];
    onClose: () => void;
    onDeviceUpdated: (device: Device) => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
};

export default function EditDeviceModal({
    isOpen,
    device,
    playlists,
    onClose,
    onDeviceUpdated,
    showToast
}: EditDeviceModalProps) {
    const [name, setName] = useState("");
    const [defaultPlaylistId, setDefaultPlaylistId] = useState("");
    const [scheduleId, setScheduleId] = useState("");
    const [schedules, setSchedules] = useState<Schedule[]>([]);

    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(false);

    // Fetch schedules on open
    useEffect(() => {
        if (isOpen) {
            setInitializing(true);
            fetch("/api/schedules")
                .then(res => res.json())
                .then(data => setSchedules(data))
                .catch(err => console.error(err))
                .finally(() => setInitializing(false));
        }
    }, [isOpen]);

    // Populate form
    useEffect(() => {
        if (device) {
            setName(device.name || "");
            setDefaultPlaylistId(device.defaultPlaylistId || "");
            setScheduleId(device.scheduleId || "");
        }
    }, [device]);

    if (!isOpen || !device) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`/api/devices/${device.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    defaultPlaylistId: defaultPlaylistId || null,
                    scheduleId: scheduleId || null,
                }),
            });

            if (res.ok) {
                const updated = await res.json();
                onDeviceUpdated(updated);
                showToast("Device updated successfully!", "success");
                onClose();
            } else {
                const err = await res.json();
                showToast(err.error || "Failed to update", "error");
            }
        } catch (error) {
            showToast("Failed to update device", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center px-6 py-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">Edit Device</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Device Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-900"
                            placeholder="My Signage Player"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Default Playlist
                            </label>
                            <p className="text-xs text-gray-500 mb-2">Plays when no schedule rule matches.</p>
                            <select
                                value={defaultPlaylistId}
                                onChange={(e) => setDefaultPlaylistId(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900"
                            >
                                <option value="">(No Default Playlist)</option>
                                {playlists.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Active Schedule
                            </label>
                            <p className="text-xs text-gray-500 mb-2">Weekly plan for content.</p>
                            {initializing ? (
                                <div className="py-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading schedules...</div>
                            ) : (
                                <select
                                    value={scheduleId}
                                    onChange={(e) => setScheduleId(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900"
                                >
                                    <option value="">(No Schedule)</option>
                                    {schedules.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
