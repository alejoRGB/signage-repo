
import React from "react";
import { Device } from "@/types/device"; // We'll need to define this type or import it

type DeviceActionsProps = {
    device: Device;
    onEdit: (device: Device) => void;
    onViewLogs: (device: Device) => void;
    onDelete: (id: string) => void;
};

import { Edit, FileText, Trash2 } from "lucide-react";

export default function DeviceActions({ device, onEdit, onViewLogs, onDelete }: DeviceActionsProps) {
    return (
        <div className="flex items-center justify-end gap-2">
            <button
                onClick={() => onEdit(device)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
                title="Edit"
            >
                <Edit className="h-4 w-4" />
            </button>
            <button
                onClick={() => onViewLogs(device)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
                title="View Logs"
            >
                <FileText className="h-4 w-4" />
            </button>
            <button
                onClick={() => onDelete(device.id)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                title="Delete"
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
    );
}
