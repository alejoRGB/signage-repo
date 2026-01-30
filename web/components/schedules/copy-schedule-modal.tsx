"use client";

import { useState } from "react";
import { Copy, X } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface CopyScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCopy: (targetDayIndex: number) => void;
    sourceDayIndex: number;
}

export default function CopyScheduleModal({ isOpen, onClose, onCopy, sourceDayIndex }: CopyScheduleModalProps) {
    const [selectedTarget, setSelectedTarget] = useState<string>("");

    if (!isOpen) return null;

    const handleCopy = () => {
        if (selectedTarget === "") return;
        onCopy(parseInt(selectedTarget));
        onClose();
        setSelectedTarget("");
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="mb-6">
                    <div className="flex items-center gap-2 text-indigo-600 mb-2">
                        <Copy className="h-5 w-5" />
                        <h2 className="text-xl font-bold text-gray-900">Copy Schedule</h2>
                    </div>
                    <p className="text-sm text-gray-500">
                        Copy all items from <span className="font-semibold text-gray-700">{DAYS[sourceDayIndex]}</span> to another day.
                        <br />
                        <span className="text-red-500 text-xs mt-1 block">Warning: This will replace all items on the target day.</span>
                    </p>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Copy to...
                    </label>
                    <select
                        value={selectedTarget}
                        onChange={(e) => setSelectedTarget(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                        <option value="" disabled>Select a day</option>
                        {DAYS.map((day, index) => (
                            <option
                                key={index}
                                value={index}
                                disabled={index === sourceDayIndex}
                            >
                                {day} {index === sourceDayIndex ? '(Source)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCopy}
                        disabled={selectedTarget === ""}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Copy Schedule
                    </button>
                </div>
            </div>
        </div>
    );
}
