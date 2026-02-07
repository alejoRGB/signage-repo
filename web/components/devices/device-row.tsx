import React, { useState, useEffect, useRef } from "react";
import { Device, Playlist } from "@/types/device";
import DeviceStatusBadge from "./device-status-badge";
import DeviceActions from "./device-actions";
import { formatDate } from "@/lib/utils";

type DeviceRowProps = {
    device: Device;
    playlists: Playlist[];
    onPlaylistChange: (deviceId: string, playlistId: string) => void;
    onEdit: (device: Device) => void;
    onViewLogs: (device: Device) => void;
    onDelete: (id: string) => void;
    updatingDeviceId?: string | null;
};

export default function DeviceRow({
    device,
    playlists,
    onPlaylistChange,
    onEdit,
    onViewLogs,
    onDelete,
    updatingDeviceId
}: DeviceRowProps) {
    const [showReady, setShowReady] = useState(false);

    // Logic for True Sync
    const isOptimisticUpdating = updatingDeviceId === device.id;
    const hasActivePlaylist = !!device.activePlaylist?.id;
    // It's synced if the reported playing ID matches the active ID
    // We treat null playingPlaylistId as not synced if there IS an active playlist
    const isSynced = device.activePlaylist?.id === device.playingPlaylistId;

    const prevSynced = useRef(isSynced);

    useEffect(() => {
        // Transition from !Synced -> Synced triggers "Ready"
        if (!prevSynced.current && isSynced && hasActivePlaylist) {
            setShowReady(true);
            const timer = setTimeout(() => setShowReady(false), 3000);
            return () => clearTimeout(timer);
        }
        prevSynced.current = isSynced;
    }, [isSynced, hasActivePlaylist]);

    // Don't show "Ready" if we are currently updating (optimistic)
    const shouldShowReady = showReady && !isOptimisticUpdating;
    const shouldShowSyncing = isOptimisticUpdating || (hasActivePlaylist && !isSynced);

    return (
        <tr className="hover:bg-gray-50">
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
                <div className="flex flex-col gap-1">
                    <select
                        value={device.activePlaylist?.id || ""}
                        onChange={(e) =>
                            onPlaylistChange(device.id, e.target.value)
                        }
                        disabled={isOptimisticUpdating}
                        className="text-sm text-gray-900 border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        <option value="">No playlist</option>
                        {playlists.map((playlist) => (
                            <option key={playlist.id} value={playlist.id}>
                                {playlist.name}
                            </option>
                        ))}
                    </select>

                    {/* Sync Status Indicators */}
                    {shouldShowSyncing && !shouldShowReady && (
                        <div className="flex items-center gap-1 text-xs text-indigo-600 animate-pulse">
                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Syncing to device...</span>
                        </div>
                    )}

                    {shouldShowReady && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                            <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">Synced</span>
                        </div>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <DeviceActions
                    device={device}
                    onEdit={onEdit}
                    onViewLogs={onViewLogs}
                    onDelete={onDelete}
                />
            </td>
        </tr>
    );
}
