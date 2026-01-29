
import React, { useState } from "react";
import { Device } from "@/types/device";

type ManualAddDeviceFormProps = {
    isOpen: boolean;
    onClose: () => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
};

export default function ManualAddDeviceForm({ isOpen, onClose, showToast }: ManualAddDeviceFormProps) {
    const [newDeviceName, setNewDeviceName] = useState("");
    const [loading, setLoading] = useState(false);
    const [newlyCreatedDevice, setNewlyCreatedDevice] = useState<Device | null>(null);

    const handleAddDevice = async (e: React.FormEvent) => {
        e.preventDefault();
        // Current implementation in main file was disabled
        showToast("Please use 'Pair Device' instead.", "info");
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast("Token copied to clipboard!", "success");
    };

    if (!isOpen) return null;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 className="text-lg font-semibold mb-4">Add New Device</h3>
            <form onSubmit={handleAddDevice} className="flex gap-4 mb-4">
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
                    onClick={onClose}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                    Cancel
                </button>
            </form>

            {/* Newly Created Device Token Display */}
            {newlyCreatedDevice && (
                <div className="bg-green-50 border border-green-200 p-6 rounded-lg mt-4">
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
        </div>
    );
}
