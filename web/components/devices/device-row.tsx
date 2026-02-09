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
                        onChange={(e) => onPlaylistChange(device.id, e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                    >
                        <option value="">Select Playlist</option>
                        {playlists.map((playlist) => (
                            <option key={playlist.id} value={playlist.id}>
                                {playlist.name}
                            </option>
                        ))}
                    </select>
                    {shouldShowSyncing && (
                        <span className="text-xs text-amber-600 animate-pulse font-medium">
                            Syncing...
                        </span>
                    )}
                    {shouldShowReady && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                            <span className="font-medium">Synced</span>
                        </div>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {device.schedule?.name || "No Schedule"}
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
