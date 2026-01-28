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
            }
        } catch (e) {
            console.error(e);
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

                                <div className="space-y-2 flex-1">
                                    {dayItems.map((item) => {
                                        // Find index in main array
                                        const globalIndex = items.indexOf(item);
                                        return (
                                            <div key={globalIndex} className="bg-white p-2 rounded shadow-sm border text-sm relative group">
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="flex gap-1 items-center">
                                                        <input
                                                            type="time"
                                                            value={item.startTime}
                                                            onChange={(e) => updateItem(globalIndex, 'startTime', e.target.value)}
                                                            className="w-16 p-0.5 border rounded text-xs"
                                                        />
                                                        <span>-</span>
                                                        <input
                                                            type="time"
                                                            value={item.endTime}
                                                            onChange={(e) => updateItem(globalIndex, 'endTime', e.target.value)}
                                                            className="w-16 p-0.5 border rounded text-xs"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => removeItem(globalIndex)}
                                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                                                    >
                                                        &times;
                                                    </button>
                                                </div>

                                                <select
                                                    value={item.playlistId}
                                                    onChange={(e) => updateItem(globalIndex, 'playlistId', e.target.value)}
                                                    className="w-full text-xs p-1 border rounded"
                                                >
                                                    <option value="">Select Playlist</option>
                                                    {playlists.map((p: any) => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => addItem(dayIndex)}
                                    className="mt-3 text-xs w-full py-2 border border-dashed border-gray-300 text-gray-500 rounded hover:bg-white hover:text-indigo-600 transition-colors"
                                >
                                    + Add Item
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
