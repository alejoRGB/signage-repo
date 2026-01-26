"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Define Pairing Types
type PairingStatus = "idle" | "loading" | "success" | "error";

type Device = {
    id: string;
    name: string;
    token: string;
    status: string;
    lastSeenAt: string | null;
    activePlaylist: { id: string; name: string } | null;
    createdAt: string;
};

type Playlist = {
    id: string;
    name: string;
};

export default function DeviceManager({
    devices: initialDevices,
    playlists,
}: {
    devices: Device[];
    playlists: Playlist[];
}) {
    const router = useRouter();
    const [devices, setDevices] = useState<Device[]>(initialDevices);
    const [showPairModal, setShowPairModal] = useState(false);
    const [pairingCode, setPairingCode] = useState("");
    const [pairingName, setPairingName] = useState("");
    const [pairingStatus, setPairingStatus] = useState<PairingStatus>("idle");

    // Manual Add Form State
    const [showAddForm, setShowAddForm] = useState(false);
    const [newDeviceName, setNewDeviceName] = useState("");
    const [loading, setLoading] = useState(false);
    const [newlyCreatedDevice, setNewlyCreatedDevice] = useState<Device | null>(null);
    const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);

    // Logs State
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [selectedDeviceForLogs, setSelectedDeviceForLogs] = useState<Device | null>(null);
    const [deviceLogs, setDeviceLogs] = useState<Array<{ id: string; level: string; message: string; timestamp: string }>>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    // Polling State
    const [lastRefreshed, setLastRefreshed] = useState(new Date());

    // 1. Poll Devices Status every 30 seconds
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                router.refresh();
                setLastRefreshed(new Date());
            } catch (error) {
                console.error("Auto-refresh failed", error);
            }
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [router]);

    // 2. Poll Logs when modal is open (every 5 seconds)
    useEffect(() => {
        if (!showLogsModal || !selectedDeviceForLogs) return;

        const fetchLogs = async () => {
            try {
                const res = await fetch(`/api/devices/${selectedDeviceForLogs.id}/logs`);
                if (res.ok) {
                    const data = await res.json();
                    setDeviceLogs(data.events || []);
                }
            } catch (error) {
                console.error("Logs auto-refresh failed", error);
            } finally {
                setLogsLoading(false);
            }
        };

        fetchLogs(); // Fetch immediately
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [showLogsModal, selectedDeviceForLogs]);


    const handlePairDevice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pairingCode.trim() || !pairingName.trim()) return;

        setPairingStatus("loading");
        try {
            const res = await fetch("/api/device/pair", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: pairingCode, name: pairingName }),
            });

            if (res.ok) {
                const device = await res.json();
                setDevices([device, ...devices]);
                setPairingStatus("success");
                setTimeout(() => {
                    setShowPairModal(false);
                    setPairingStatus("idle");
                    setPairingCode("");
                    setPairingName("");
                }, 1500);
            } else {
                const error = await res.json();
                alert(error.error || "Failed to pair device");
                setPairingStatus("error");
            }
        } catch (error) {
            alert("Error pairing device");
            setPairingStatus("error");
        }
    };

    const handleAddDevice = async (e: React.FormEvent) => {
        // Placeholder for manual add if needed
        e.preventDefault();
        alert("Please use 'Pair Device' instead.");
    };

    const handleDelete = (id: string) => {
        setDeviceToDelete(id);
    };

    const confirmDelete = async () => {
        if (!deviceToDelete) return;

        try {
            const res = await fetch(`/api/devices/${deviceToDelete}`, {
                method: "DELETE",
            });

            if (res.ok) {
                setDevices(devices.filter((d) => d.id !== deviceToDelete));
                alert("Device deleted successfully!");
            } else {
                const data = await res.json();
                alert(`Failed to delete device: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error("Error deleting device:", error);
            alert("Error deleting device.");
        } finally {
            setDeviceToDelete(null);
        }
    };

    const handlePlaylistChange = async (deviceId: string, playlistId: string) => {
        try {
            const res = await fetch(`/api/devices/${deviceId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    activePlaylistId: playlistId || null,
                }),
            });

            if (res.ok) {
                const updatedDevice = await res.json();
                // Merge update but preserve calculated status for UI consistency
                setDevices(
                    devices.map((d) => {
                        if (d.id === deviceId) {
                            return {
                                ...updatedDevice,
                                status: d.status, // Keep the calculated status from page load
                                lastSeenAt: d.lastSeenAt, // Keep lastSeenAt unless we know it changed
                                activePlaylist: updatedDevice.activePlaylist || null,
                                name: updatedDevice.name || d.name
                            };
                        }
                        return d;
                    })
                );
                alert("Playlist assigned successfully!");
            } else {
                const error = await res.json();
                alert(`Failed to update playlist: ${error.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error("Error updating playlist:", error);
            alert("Error updating playlist");
        }
    };

    const handlePushPlaylist = async (deviceId: string) => {
        alert("✅ Playlist update queued!\n\nThe device will automatically detect this change and start downloading the new content within 60 seconds.");
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Token copied to clipboard!");
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "Never";
        return new Date(dateString).toLocaleString();
    };

    const handleViewLogs = async (device: Device) => {
        setSelectedDeviceForLogs(device);
        setShowLogsModal(true);
        setLogsLoading(true);
        // data check handled by useEffect
    };

    const getLogLevelColor = (level: string) => {
        switch (level.toLowerCase()) {
            case 'error': return 'bg-red-100 text-red-800';
            case 'warning': return 'bg-orange-100 text-orange-800';
            case 'info': return 'bg-blue-100 text-blue-800';
            case 'debug': return 'bg-gray-100 text-gray-600';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Devices</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Manage your digital signage devices
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowPairModal(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                        <span>🔗</span> Pair Device
                    </button>
                    {/* Optional: Keep Manual Add for testing validation */}
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        Manual Add
                    </button>
                </div>
            </div>

            {/* Pair Device Modal */}
            {showPairModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Pair New Device</h3>
                            <button
                                onClick={() => setShowPairModal(false)}
                                className="text-gray-400 hover:text-gray-500"
                            >
                                ✕
                            </button>
                        </div>

                        {pairingStatus === "success" ? (
                            <div className="text-center py-8">
                                <div className="text-green-500 text-5xl mb-4">✓</div>
                                <h4 className="text-xl font-semibold text-gray-900">Device Paired!</h4>
                                <p className="text-gray-500 mt-2">The device has been successfully linked.</p>
                            </div>
                        ) : (
                            <form onSubmit={handlePairDevice} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Pairing Code (shown on device)
                                    </label>
                                    <input
                                        type="text"
                                        value={pairingCode}
                                        onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="000000"
                                        className="w-full px-4 py-3 text-2xl text-center tracking-widest border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 font-mono"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Device Name
                                    </label>
                                    <input
                                        type="text"
                                        value={pairingName}
                                        onChange={(e) => setPairingName(e.target.value)}
                                        placeholder="e.g. Lobby Screen"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowPairModal(false)}
                                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={pairingStatus === "loading" || pairingCode.length < 6 || !pairingName}
                                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {pairingStatus === "loading" ? "Pairing..." : "Pair Device"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Manual Add Device Form (Collapsible) */}

            {/* Add Device Form */}
            {showAddForm && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Add New Device</h3>
                    <form onSubmit={handleAddDevice} className="flex gap-4">
                        <input
                            type="text"
                            value={newDeviceName}
                            onChange={(e) => setNewDeviceName(e.target.value)}
                            placeholder="Device name (e.g., Lobby Display)"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                        >
                            {loading ? "Creating..." : "Create"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAddForm(false)}
                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {/* Newly Created Device Token Display */}
            {newlyCreatedDevice && (
                <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-green-900 mb-2">
                                Device Created Successfully!
                            </h3>
                            <p className="text-sm text-green-700 mb-4">
                                Copy this token and save it in your device's config.json file. You won't be able to see it again.
                            </p>
                            <div className="bg-white p-4 rounded border border-green-300">
                                <p className="text-xs text-gray-600 mb-1">Device Token:</p>
                                <code className="text-sm font-mono text-gray-900 break-all">
                                    {newlyCreatedDevice.token}
                                </code>
                            </div>
                        </div>
                        <div className="ml-4 flex gap-2">
                            <button
                                onClick={() => copyToClipboard(newlyCreatedDevice.token)}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                            >
                                Copy Token
                            </button>
                            <button
                                onClick={() => setNewlyCreatedDevice(null)}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deviceToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Confirm Deletion
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete this device? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeviceToDelete(null)}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            >
                                Delete Device
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Devices Table */}
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
                                        <span
                                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${device.status === "online"
                                                ? "bg-green-100 text-green-800"
                                                : "bg-gray-100 text-gray-800"
                                                }`}
                                        >
                                            {device.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" suppressHydrationWarning>
                                        {formatDate(device.lastSeenAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <select
                                            value={device.activePlaylist?.id || ""}
                                            onChange={(e) =>
                                                handlePlaylistChange(device.id, e.target.value)
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
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                        {device.activePlaylist && (
                                            <button
                                                onClick={() => handlePushPlaylist(device.id)}
                                                className="text-blue-600 hover:text-blue-900 font-medium"
                                            >
                                                Push Playlist
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleViewLogs(device)}
                                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                                        >
                                            View Logs
                                        </button>
                                        <button
                                            onClick={() => handleDelete(device.id)}
                                            className="text-red-600 hover:text-red-900 font-medium"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Watchdog/System Logs Modal */}
            {showLogsModal && selectedDeviceForLogs && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Device Logs - {selectedDeviceForLogs.name}
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowLogsModal(false);
                                        setSelectedDeviceForLogs(null);
                                        setDeviceLogs([]);
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                            {logsLoading ? (
                                <div className="text-center py-8 text-gray-500">
                                    Loading logs...
                                </div>
                            ) : deviceLogs.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    No logs recorded for this device.
                                </div>
                            ) : (
                                <div className="space-y-2 font-mono text-sm">
                                    {deviceLogs.map((log) => (
                                        <div key={log.id} className="bg-white border border-gray-200 rounded p-3 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-start gap-3">
                                                <span className={`shrink-0 px-2 py-0.5 text-xs font-bold rounded uppercase ${getLogLevelColor(log.level)}`}>
                                                    {log.level}
                                                </span>
                                                <span className="shrink-0 text-gray-500 text-xs mt-0.5" suppressHydrationWarning>
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </span>
                                                <div className="text-gray-900 break-all whitespace-pre-wrap">
                                                    {log.message}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-200 bg-white rounded-b-lg">
                            <button
                                onClick={() => {
                                    setShowLogsModal(false);
                                    setSelectedDeviceForLogs(null);
                                    setDeviceLogs([]);
                                }}
                                className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
