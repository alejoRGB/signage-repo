
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Device, Playlist } from "@/types/device";
import DeviceListTable from "@/components/devices/device-list-table";
import PairDeviceModal from "@/components/devices/pair-device-modal";
import ManualAddDeviceForm from "@/components/devices/manual-add-device-form";
import DeviceLogsModal from "@/components/devices/device-logs-modal";
import ConfirmModal from "@/components/confirm-modal";
import EditDeviceModal from "@/components/devices/edit-device-modal";
import { useToast } from "@/components/ui/toast-context";

export default function DeviceManager({
    devices: initialDevices,
    playlists,
}: {
    devices: Device[];
    playlists: Playlist[];
}) {
    const router = useRouter();
    const { showToast } = useToast();
    const [devices, setDevices] = useState<Device[]>(initialDevices);

    // Modals State
    const [showPairModal, setShowPairModal] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedDeviceForLogs, setSelectedDeviceForLogs] = useState<Device | null>(null);
    const [deviceToEdit, setDeviceToEdit] = useState<Device | null>(null); // New state
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

    // Toast Logic replaced by useToast hook

    // Handlers
    const handleDevicePaired = (newDevice: Device) => {
        setDevices([newDevice, ...devices]);
    };

    const handleDeviceUpdated = (updatedDevice: Device) => {
        setDevices(devices.map(d => d.id === updatedDevice.id ? { ...d, ...updatedDevice } : d));
        router.refresh();
    };

    const handlePlaylistChange = async (deviceId: string, playlistId: string) => {
        try {
            const res = await fetch(`/api/devices/${deviceId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    activePlaylistId: playlistId || null,
                    defaultPlaylistId: playlistId || null,
                }),
            });

            if (res.ok) {
                const updatedDevice = await res.json();
                handleDeviceUpdated(updatedDevice);
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
                    {/* Manual Add button removed */}
                </div>
            </div>

            <PairDeviceModal
                isOpen={showPairModal}
                onClose={() => setShowPairModal(false)}
                onDevicePaired={handleDevicePaired}
                showToast={showToast}
            />

// Removed ManualAddDeviceForm usage per user request

            <EditDeviceModal
                isOpen={!!deviceToEdit}
                device={deviceToEdit}
                playlists={playlists}
                onClose={() => setDeviceToEdit(null)}
                onDeviceUpdated={handleDeviceUpdated}
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
                onEdit={setDeviceToEdit} // Pass setter as handler
                onViewLogs={setSelectedDeviceForLogs}
                onDelete={handleDeleteClick}
            />

            {/* Toast Container removed */}

        </div>
    );
}
