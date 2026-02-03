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
    const inputRef = useRef<HTMLInputElement>(null); // Added inputRef
    const [text, setText] = useState(formatTime(value));

    // Update text when value changes externally, BUT ONLY if not focused
    // This prevents the cursor from jumping while typing
    useEffect(() => {
        if (document.activeElement !== inputRef.current) {
            setText(formatTime(value));
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newText = e.target.value;
        setText(newText);

        // Optimistically update parent state if valid
        // This fixes the race condition where clicking "Save" immediately after typing
        // would use the old value because onBlur hasn't finished updating state.
        const seconds = parseTime(newText);
        onChange(seconds);
    };

    const handleBlur = () => {
        const seconds = parseTime(text);
        setText(formatTime(seconds)); // normalize text on blur (e.g. 70 -> 01:10)
        onChange(seconds);
    };

    return (
        <input // Changed to 'input' as per original, assuming 'Input' was a typo or external component not provided.
            ref={inputRef}
            type="text"
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.currentTarget.blur();
                }
            }}
            disabled={disabled} // Re-added disabled prop
            placeholder="MM:SS"
            className="w-20 text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-1 text-center font-mono disabled:bg-gray-100 disabled:text-gray-500" // Merged new and old classNames
        />
    );
}
