
import React, { useState } from "react";
import { Device } from "@/types/device";

type PairDeviceModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onDevicePaired: (device: Device) => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
};

export default function PairDeviceModal({ isOpen, onClose, onDevicePaired, showToast }: PairDeviceModalProps) {
    const [pairingCode, setPairingCode] = useState("");
    const [pairingName, setPairingName] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

    const handlePairDevice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pairingCode.trim() || !pairingName.trim()) return;

        setStatus("loading");
        try {
            const res = await fetch("/api/device/pair", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: pairingCode, name: pairingName }),
            });

            if (res.ok) {
                const device = await res.json();
                onDevicePaired(device);
                setStatus("success");
                showToast("Device paired successfully!", "success");
                setTimeout(() => {
                    onClose();
                    // Reset state
                    setStatus("idle");
                    setPairingCode("");
                    setPairingName("");
                }, 1500);
            } else {
                const error = await res.json();
                showToast(error.error || "Failed to pair device", "error");
                setStatus("error");
            }
        } catch (error) {
            showToast("Error pairing device", "error");
            setStatus("error");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Pair New Device</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500"
                    >
                        ✕
                    </button>
                </div>

                {status === "success" ? (
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
                                className="w-full px-4 py-3 text-2xl text-center tracking-widest border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 font-mono bg-white text-gray-900 placeholder:text-gray-400"
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
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 placeholder:text-gray-400"
                            />
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={status === "loading" || pairingCode.length < 6 || !pairingName}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {status === "loading" ? "Pairing..." : "Pair Device"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
