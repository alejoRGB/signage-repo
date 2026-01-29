
import React from "react";

type DeviceStatusBadgeProps = {
    status: string; // The administrative status from DB
    connectivity?: string; // The calculated connectivity status (online/offline)
};

export default function DeviceStatusBadge({ status, connectivity }: DeviceStatusBadgeProps) {

    let label = connectivity || status;
    let colorClass = "bg-gray-100 text-gray-800"; // Default (Offline/Unknown)

    // 1. Connectivity Check
    if (connectivity === "online") {
        colorClass = "bg-green-100 text-green-800";
    } else if (connectivity === "offline") {
        colorClass = "bg-gray-100 text-gray-800";
    }

    // 2. Administrative/Special Status Overrides
    // If the device is unpaired, we prioritize that information
    if (status === "unpaired") {
        label = "Unpaired";
        colorClass = "bg-yellow-100 text-yellow-800";
    }

    // Future: If status === 'disabled', make it red

    return (
        <span
            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colorClass} capitalize`}
        >
            {label}
        </span>
    );
}
