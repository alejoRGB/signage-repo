"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, FileVideo, Globe } from "lucide-react";

type DashboardDevice = {
    id: string;
    name: string | null;
    createdAt: string;
    lastSeenAt: string | null;
    connectivityStatus?: string;
    currentContentName?: string | null;
    contentPreview?: {
        type: string;
        url: string;
        name: string;
    } | null;
    activePlaylist?: { id: string; name: string } | null;
    playingPlaylist?: { id: string; name: string } | null;
    schedule?: { id: string; name: string } | null;
};

const ONLINE_STALE_MS = 5 * 60_000;
const POLL_INTERVAL_MS = 5_000;

function twoLineClampStyle() {
    return {
        display: "-webkit-box",
        WebkitBoxOrient: "vertical" as const,
        WebkitLineClamp: 2,
        overflow: "hidden",
    };
}

function isDeviceOnline(device: DashboardDevice) {
    if (device.connectivityStatus) {
        return device.connectivityStatus === "online";
    }

    if (!device.lastSeenAt) return false;
    return Date.now() - new Date(device.lastSeenAt).getTime() <= ONLINE_STALE_MS;
}

export default function DevicePreviewGrid({
    initialDevices,
}: {
    initialDevices: DashboardDevice[];
}) {
    const [devices, setDevices] = useState<DashboardDevice[]>(initialDevices);
    const [expandedById, setExpandedById] = useState<Record<string, boolean>>(
        () => Object.fromEntries(initialDevices.map((device) => [device.id, true])),
    );

    useEffect(() => {
        setDevices(initialDevices);
    }, [initialDevices]);

    useEffect(() => {
        setExpandedById((prev) => {
            const next: Record<string, boolean> = {};
            for (const device of devices) {
                next[device.id] = prev[device.id] ?? true;
            }
            return next;
        });
    }, [devices]);

    const refreshDevices = useCallback(async () => {
        try {
            const response = await fetch("/api/devices?order=created_asc", { cache: "no-store" });
            if (!response.ok) return;

            const latestDevices = await response.json() as DashboardDevice[];
            setDevices(latestDevices);
        } catch (error) {
            console.error("Dashboard preview polling failed", error);
        }
    }, []);

    useEffect(() => {
        const timer = setInterval(refreshDevices, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [refreshDevices]);

    const toggleExpanded = (deviceId: string) => {
        setExpandedById((prev) => ({ ...prev, [deviceId]: !prev[deviceId] }));
    };

    return (
        <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">Device Live Preview</h2>

            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {devices.map((device) => {
                    const isExpanded = !!expandedById[device.id];
                    const online = isDeviceOnline(device);
                    const preview = device.contentPreview;

                    return (
                        <div
                            key={device.id}
                            className={`overflow-hidden rounded-lg bg-white shadow transition-all duration-200 ${isExpanded ? "h-[280px]" : "h-[84px]"}`}
                        >
                            <button
                                type="button"
                                onClick={() => toggleExpanded(device.id)}
                                className="flex w-full items-center justify-between px-4 py-3 text-left"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-gray-900">
                                        {device.name || "Unnamed Device"}
                                    </p>
                                    <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${online ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                                        {online ? "online" : "offline"}
                                    </p>
                                </div>
                                <span className="text-gray-500">
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </span>
                            </button>

                            {isExpanded && (
                                <div className="space-y-2 px-4 pb-4">
                                    <div className="h-28 w-full overflow-hidden rounded-md bg-gray-100">
                                        {preview ? (
                                            preview.type === "video" ? (
                                                <div className="relative flex h-full w-full items-center justify-center bg-gray-900">
                                                    <FileVideo className="h-10 w-10 text-gray-500" />
                                                    <video src={preview.url} className="absolute inset-0 h-full w-full object-cover opacity-50" />
                                                </div>
                                            ) : preview.type === "image" ? (
                                                <img
                                                    src={preview.url}
                                                    alt={preview.name}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full flex-col items-center justify-center bg-indigo-50">
                                                    <Globe className="mb-2 h-10 w-10 text-indigo-400" />
                                                    <span className="max-w-[150px] truncate px-4 text-center text-xs font-medium text-indigo-900">
                                                        {preview.name}
                                                    </span>
                                                </div>
                                            )
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-sm font-medium text-gray-500">
                                                {online ? "preview unavailable" : "offline"}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Current content</p>
                                        <p className="text-sm text-gray-900" style={twoLineClampStyle()}>
                                            {device.currentContentName || "No playback"}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Playlist</p>
                                        <p className="text-sm text-gray-900" style={twoLineClampStyle()}>
                                            {device.activePlaylist?.name || "No Playlist"}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Schedule</p>
                                        <p className="text-sm text-gray-900" style={twoLineClampStyle()}>
                                            {device.schedule?.name || "No Schedule"}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
