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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="mb-6">
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <Copy className="h-5 w-5" />
                        <h2 className="text-xl font-bold text-foreground font-display tracking-tight">Copy Schedule</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Copy all items from <span className="font-semibold text-foreground">{DAYS[sourceDayIndex]}</span> to another day.
                        <br />
                        <span className="text-red-400 text-xs mt-1 block">Warning: This will replace all items on the target day.</span>
                    </p>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-2">
                        Copy to...
                    </label>
                    <div className="relative">
                        <select
                            value={selectedTarget}
                            onChange={(e) => setSelectedTarget(e.target.value)}
                            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-black/40 text-foreground appearance-none"
                        >
                            <option value="" disabled className="bg-card">Select a day</option>
                            {DAYS.map((day, index) => (
                                <option
                                    key={index}
                                    value={index}
                                    disabled={index === sourceDayIndex}
                                    className="bg-card"
                                >
                                    {day} {index === sourceDayIndex ? '(Source)' : ''}
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-muted-foreground">
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground bg-secondary/50 rounded-md hover:bg-secondary hover:text-foreground transition-colors border border-border"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCopy}
                        disabled={selectedTarget === ""}
                        className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
                    >
                        Copy Schedule
                    </button>
                </div>
            </div>
        </div>
    );
}
