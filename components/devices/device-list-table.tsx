
import React from "react";
import { Device, Playlist } from "@/types/device";
import DeviceStatusBadge from "./device-status-badge";
import DeviceActions from "./device-actions";
import { formatDate } from "@/lib/utils";

type DeviceListTableProps = {
    devices: Device[];
    playlists: Playlist[];
    onPlaylistChange: (deviceId: string, playlistId: string) => void;
    onPushPlaylist: (deviceId: string) => void;
    onViewLogs: (device: Device) => void;
    onDelete: (id: string) => void;
};

export default function DeviceListTable({
    devices,
    playlists,
    onPlaylistChange,
    onPushPlaylist,
    onViewLogs,
    onDelete
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
                            <tr key={device.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">
                                        {device.name}
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono">
                                        {device.id}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <DeviceStatusBadge status={device.status} connectivity={device.connectivityStatus} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" suppressHydrationWarning>
                                    {formatDate(device.lastSeenAt)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <select
                                        value={device.activePlaylist?.id || ""}
                                        onChange={(e) =>
                                            onPlaylistChange(device.id, e.target.value)
                                        }
                                        className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">No playlist</option>
                                        {playlists.map((playlist) => (
                                            <option key={playlist.id} value={playlist.id}>
                                                {playlist.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <DeviceActions
                                        device={device}
                                        onPushPlaylist={onPushPlaylist}
                                        onEdit={onEdit}
                                        onViewLogs={onViewLogs}
                                        onDelete={onDelete}
                                    />
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
