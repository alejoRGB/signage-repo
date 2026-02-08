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
        <tr className="hover:bg-white/5 transition-colors group">
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-foreground">
                    {device.name}
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {device.id}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <DeviceStatusBadge status={device.status} connectivity={device.connectivityStatus} />
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground font-mono" suppressHydrationWarning>
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
                        className="text-sm bg-card text-foreground border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 min-w-[140px]"
                    >
                        <option value="">No playlist</option>
                        {playlists.map((playlist) => (
                            <option key={playlist.id} value={playlist.id}>
                                {playlist.name}
                            </option>
                        ))}
                    </select>


                    {shouldShowReady && (
                        <div className="flex items-center gap-1 text-xs text-green-400">
                            <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">Synced</span>
                        </div>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
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
