
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Device, Playlist } from "@/types/device";
import DeviceListTable from "@/components/devices/device-list-table";
import PairDeviceModal from "@/components/devices/pair-device-modal";
import ManualAddDeviceForm from "@/components/devices/manual-add-device-form";
import DeviceLogsModal from "@/components/devices/device-logs-modal";
import ConfirmModal from "@/components/confirm-modal";

export default function DeviceManager({
    devices: initialDevices,
    playlists,
}: {
    devices: Device[];
    playlists: Playlist[];
}) {
    const router = useRouter();
    const [devices, setDevices] = useState<Device[]>(initialDevices);

    // Modals State
    const [showPairModal, setShowPairModal] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedDeviceForLogs, setSelectedDeviceForLogs] = useState<Device | null>(null);
    const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);

    // Sync state with props when router.refresh() fetches new data
    useEffect(() => {
        setDevices(initialDevices);
    }, [initialDevices]);

    // Polling State (Refresh list every 10s)
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                router.refresh();
            } catch (error) {
                console.error("Auto-refresh failed", error);
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [router]);

    // Toast State
    const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    // Handlers
    const handleDevicePaired = (newDevice: Device) => {
        setDevices([newDevice, ...devices]);
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
                setDevices(
                    devices.map((d) => {
                        if (d.id === deviceId) {
                            return {
                                ...updatedDevice,
                                status: d.status, // Preserve status from client-side list if needed, or use server's
                                lastSeenAt: d.lastSeenAt,
                                activePlaylist: updatedDevice.activePlaylist || null,
                                name: updatedDevice.name || d.name
                            };
                        }
                        return d;
                    })
                );
                showToast("Playlist assigned successfully!", "success");
            } else {
                const error = await res.json();
                showToast(`Failed to update playlist: ${error.error || 'Unknown error'}`, "error");
            }
        } catch (error) {
            console.error("Error updating playlist:", error);
            showToast("Error updating playlist", "error");
        }
    };

    const handlePushPlaylist = async (deviceId: string) => {
        showToast("Playlist update queued! Device will update shortly.", "success");
    };

    const handleDeleteClick = (id: string) => {
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
                showToast("Device deleted successfully!", "success");
            } else {
                const data = await res.json();
                showToast(`Failed to delete device: ${data.error || 'Unknown error'}`, "error");
            }
        } catch (error) {
            console.error("Error deleting device:", error);
            showToast("Error deleting device.", "error");
        } finally {
            setDeviceToDelete(null);
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
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        Manual Add
                    </button>
                </div>
            </div>

            <PairDeviceModal
                isOpen={showPairModal}
                onClose={() => setShowPairModal(false)}
                onDevicePaired={handleDevicePaired}
                showToast={showToast}
            />

            <ManualAddDeviceForm
                isOpen={showAddForm}
                onClose={() => setShowAddForm(false)}
                showToast={showToast}
            />

            <DeviceLogsModal
                isOpen={!!selectedDeviceForLogs}
                device={selectedDeviceForLogs}
                onClose={() => setSelectedDeviceForLogs(null)}
            />

            <ConfirmModal
                isOpen={!!deviceToDelete}
                onClose={() => setDeviceToDelete(null)}
                onConfirm={confirmDelete}
                title="Delete Device"
                message="Are you sure you want to delete this device? This action cannot be undone."
                confirmText="Delete Device"
                isDestructive={true}
            />

            <DeviceListTable
                devices={devices}
                playlists={playlists}
                onPlaylistChange={handlePlaylistChange}
                onPushPlaylist={handlePushPlaylist}
                onViewLogs={setSelectedDeviceForLogs}
                onDelete={handleDeleteClick}
            />

            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto transform transition-all duration-300 ease-in-out
                            px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px]
                            ${toast.type === 'success' ? 'bg-white border-l-4 border-green-500 text-gray-800' : ''}
                            ${toast.type === 'error' ? 'bg-white border-l-4 border-red-500 text-gray-800' : ''}
                            ${toast.type === 'info' ? 'bg-white border-l-4 border-blue-500 text-gray-800' : ''}
                        `}
                    >
                        <span className="text-lg">
                            {toast.type === 'success' && '✅'}
                            {toast.type === 'error' && '❌'}
                            {toast.type === 'info' && 'ℹ️'}
                        </span>
                        <p className="text-sm font-medium">{toast.message}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
