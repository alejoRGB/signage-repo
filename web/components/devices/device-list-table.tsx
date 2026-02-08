
import React from "react";
import { Device, Playlist } from "@/types/device";
import DeviceRow from "./device-row";

type DeviceListTableProps = {
    devices: Device[];
    playlists: Playlist[];
    onPlaylistChange: (deviceId: string, playlistId: string) => void;
    onEdit: (device: Device) => void;
    onViewLogs: (device: Device) => void;
    onDelete: (id: string) => void;
    updatingDeviceId?: string | null;
};

export default function DeviceListTable({
    devices,
    playlists,
    onPlaylistChange,
    onEdit,
    onViewLogs,
    onDelete,
    updatingDeviceId
}: DeviceListTableProps) {
    return (

        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
            <table className="min-w-full divide-y divide-border">
                <thead className="bg-white/2">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Device
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Last Seen
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Active Playlist
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Schedule
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border/50">
                    {devices.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                No devices yet. Click "Pair Device" above to get started.
                            </td>
                        </tr>
                    ) : (
                        devices.map((device) => (
                            <DeviceRow
                                key={device.id}
                                device={device}
                                playlists={playlists}
                                onPlaylistChange={onPlaylistChange}
                                onEdit={onEdit}
                                onViewLogs={onViewLogs}
                                onDelete={onDelete}
                                updatingDeviceId={updatingDeviceId}
                            />
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
