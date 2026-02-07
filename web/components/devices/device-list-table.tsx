
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
    onEdit: (device: Device) => void;
    onViewLogs: (device: Device) => void;
    onDelete: (id: string) => void;
    updatingDeviceId?: string | null;
};

export default function DeviceListTable({
    devices,
    playlists,
    onPlaylistChange,
    onPushPlaylist,
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
                                    {updatingDeviceId === device.id ? (
                                        <div className="flex items-center gap-2 text-sm text-indigo-600 animate-pulse">
                                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Syncing...</span>
                                        </div>
                                    ) : (
                                        <select
                                            value={device.activePlaylist?.id || ""}
                                            onChange={(e) =>
                                                onPlaylistChange(device.id, e.target.value)
                                            }
                                            disabled={!!updatingDeviceId} // Disable others while one is updating
                                            className="text-sm text-gray-900 border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                        >
                                            <option value="">No playlist</option>
                                            {playlists.map((playlist) => (
                                                <option key={playlist.id} value={playlist.id}>
                                                    {playlist.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
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
