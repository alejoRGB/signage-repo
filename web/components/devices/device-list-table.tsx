
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Device
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Seen
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Active Playlist
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Schedule
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {devices.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                No devices yet. Click "Add Device" to get started.
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
