
import React from "react";
import { Device } from "@/types/device"; // We'll need to define this type or import it

type DeviceActionsProps = {
    device: Device;
    onPushPlaylist: (deviceId: string) => void;
    onEdit: (device: Device) => void;
    onViewLogs: (device: Device) => void;
    onDelete: (id: string) => void;
};

export default function DeviceActions({ device, onPushPlaylist, onEdit, onViewLogs, onDelete }: DeviceActionsProps) {
    return (
        <div className="flex items-center justify-end gap-4">
            {device.activePlaylist && (
                <button
                    onClick={() => onPushPlaylist(device.id)}
                    className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-1.5 rounded shadow-sm transition-colors text-sm font-semibold"
                >
                    Push Playlist
                </button>
            )}
            <div className="flex gap-3">
                <button
                    onClick={() => onEdit(device)}
                    className="text-gray-500 hover:text-indigo-600 text-xs transition-colors"
                >
                    Edit
                </button>
                <button
                    onClick={() => onViewLogs(device)}
                    className="text-gray-500 hover:text-indigo-600 text-xs transition-colors"
                >
                    View Logs
                </button>
                <button
                    onClick={() => onDelete(device.id)}
                    className="text-gray-400 hover:text-red-600 text-xs transition-colors"
                >
                    Delete
                </button>
            </div>
        </div>
    );
}
