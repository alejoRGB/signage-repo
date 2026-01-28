"use client";

import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Loader2, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";

// Types
type ScheduleItem = {
    id?: string;
    dayOfWeek: number;
    startTime: string; // "HH:MM"
    endTime: string;   // "HH:MM"
    playlistId: string;
    playlist?: { name: string };
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ScheduleEditor({ scheduleId }: { scheduleId: string }) {
    const { data: schedule, error } = useSWR(`/api/schedules/${scheduleId}`, fetcher);
    const { data: playlists } = useSWR("/api/playlists", fetcher);
    const { mutate } = useSWRConfig();

    const [name, setName] = useState("");
    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Initial load
    useEffect(() => {
        if (schedule) {
            setName(schedule.name);
            setItems(schedule.items || []);
        }
    }, [schedule]);

    // -- Simple Logic for Phase 1: List of Rules per Day --
    // We can upgrade to Drag & Drop later.

    const addItem = (day: number) => {
        const newItem: ScheduleItem = {
            dayOfWeek: day,
            startTime: "08:00",
            endTime: "12:00",
            playlistId: playlists?.[0]?.id || "",
        };
        setItems([...items, newItem]);
        setIsDirty(true);
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
        setIsDirty(true);
    };

    const updateItem = (index: number, field: keyof ScheduleItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
        setIsDirty(true);
    };

    const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/schedules/${scheduleId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, items }),
            });
            if (res.ok) {
                mutate(`/api/schedules/${scheduleId}`);
                setIsDirty(false);
                showToast("Schedule saved successfully!", "success");
            } else {
                showToast("Failed to save schedule.", "error");
            }
        } catch (e) {
            console.error(e);
            showToast("Error saving schedule.", "error");
        } finally {
            setSaving(false);
        }
    };

    if (error) return <div>Failed to load</div>;
    if (!schedule || !playlists) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="border-b px-6 py-4 flex justify-between items-center bg-gray-50">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setIsDirty(true); }}
                    className="text-lg font-bold bg-transparent border-none focus:ring-0 w-1/2"
                />

                <button
                    onClick={handleSave}
                    disabled={!isDirty || saving}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                    Save Changes
                </button>
            </div>

            {/* Grid / List Editor */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                    {DAYS.map((dayName, dayIndex) => {
                        // 0=Sunday (in Data), lets follow standard US for now or user locale. 
                        // Implementation detail: Javascript Date.getDay() 0=Sunday.
                        // Filter items for this day
                        const dayItems = items.filter(i => i.dayOfWeek === dayIndex).sort((a, b) => a.startTime.localeCompare(b.startTime));

                        return (
                            <div key={dayIndex} className="bg-gray-50 rounded-lg p-3 min-h-[300px] border border-gray-200 flex flex-col">
                                <h3 className="font-semibold text-center mb-4 text-gray-700 border-b pb-2">{dayName}</h3>

                                <div className="space-y-3 flex-1">
                                    {dayItems.map((item) => {
                                        // Find index in main array
                                        const globalIndex = items.indexOf(item);
                                        return (
                                            <div key={globalIndex} className="bg-white p-3 rounded shadow-sm border text-sm relative group transition-all hover:shadow-md">
                                                <button
                                                    onClick={() => removeItem(globalIndex)}
                                                    className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                    title="Remove item"
                                                >
                                                    &times;
                                                </button>

                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <input
                                                            type="time"
                                                            value={item.startTime}
                                                            onChange={(e) => updateItem(globalIndex, 'startTime', e.target.value)}
                                                            className="w-full p-1 border rounded text-xs bg-gray-50 focus:ring-1 focus:ring-indigo-500"
                                                        />
                                                        <span className="text-gray-400">-</span>
                                                        <input
                                                            type="time"
                                                            value={item.endTime}
                                                            onChange={(e) => updateItem(globalIndex, 'endTime', e.target.value)}
                                                            className="w-full p-1 border rounded text-xs bg-gray-50 focus:ring-1 focus:ring-indigo-500"
                                                        />
                                                    </div>

                                                    <select
                                                        value={item.playlistId}
                                                        onChange={(e) => updateItem(globalIndex, 'playlistId', e.target.value)}
                                                        className="w-full text-xs p-1.5 border rounded bg-white focus:ring-1 focus:ring-indigo-500"
                                                    >
                                                        <option value="">Select Playlist</option>
                                                        {playlists.map((p: any) => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => addItem(dayIndex)}
                                    className="mt-3 text-xs w-full py-2 border border-dashed border-gray-300 text-gray-500 rounded hover:bg-white hover:text-indigo-600 transition-colors flex items-center justify-center gap-1"
                                >
                                    <Plus className="w-3 h-3" /> Add Item
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto transform transition-all duration-300 ease-in-out
                            px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px]
                            ${toast.type === 'success' ? 'bg-white border-l-4 border-green-500 text-gray-800' : ''}
                            ${toast.type === 'error' ? 'bg-white border-l-4 border-red-500 text-gray-800' : ''}
                            ${toast.type === 'info' ? 'bg-white border-l-4 border-blue-500 text-gray-800' : ''}
                        `}
                    >
                        <span className="text-lg">
                            {toast.type === 'success' && '✅'}
                            {toast.type === 'error' && '❌'}
                            {toast.type === 'info' && 'ℹ️'}
                        </span>
                        <p className="text-sm font-medium">{toast.message}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
