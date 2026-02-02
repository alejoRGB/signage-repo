"use client";

import { useState, useEffect } from "react";

// Helper: 70 -> "01:10"
export const formatTime = (seconds: number): string => {
    if (!seconds && seconds !== 0) return "00:10";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Helper: "01:10" -> 70, "10" -> 10, "1:30" -> 90
export const parseTime = (input: string): number => {
    // Remove non-digit/colon chars
    const clean = input.replace(/[^\d:]/g, "");

    if (clean.includes(":")) {
        const parts = clean.split(":");
        if (parts.length === 2) {
            const m = parseInt(parts[0]) || 0;
            const s = parseInt(parts[1]) || 0;
            return m * 60 + s;
        }
    }

    // Treat as raw seconds if no colon (or fallback)
    return parseInt(clean) || 0;
};

interface DurationInputProps {
    value: number;
    onChange: (val: number) => void;
    disabled?: boolean;
}

export default function DurationInput({ value, onChange, disabled }: DurationInputProps) {
    const [text, setText] = useState(formatTime(value));

    // Sync state when prop changes (critical for drag-drop reordering)
    useEffect(() => {
        setText(formatTime(value));
    }, [value]);

    const handleBlur = () => {
        const seconds = parseTime(text);
        const valid = seconds > 0 ? seconds : 10; // Min 10s default
        onChange(valid);
        setText(formatTime(valid));
    };

    return (
        <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.currentTarget.blur();
                }
            }}
            disabled={disabled}
            className="w-20 text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-1 text-center font-mono disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="MM:SS"
        />
    );
}
