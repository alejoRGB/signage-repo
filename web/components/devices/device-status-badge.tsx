
import React from "react";

type DeviceStatusBadgeProps = {
    status: string; // The administrative status from DB
    connectivity?: string; // The calculated connectivity status (online/offline)
};

export default function DeviceStatusBadge({ status, connectivity }: DeviceStatusBadgeProps) {

    let label = connectivity || status;
    // Default (Offline/Unknown) - Deep Space Style
    let colorClass = "bg-red-500/10 text-red-500 border border-red-500/20";

    // 1. Connectivity Check
    if (connectivity === "online") {
        colorClass = "bg-green-500/10 text-green-400 border border-green-500/20";
    } else if (connectivity === "offline") {
        colorClass = "bg-red-500/10 text-red-500 border border-red-500/20";
    }

    // 2. Administrative/Special Status Overrides
    if (status === "unpaired") {
        label = "Unpaired";
        colorClass = "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20";
    }

    return (
        <span
            className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${colorClass}`}
        >
            {label}
        </span>
    );
}
