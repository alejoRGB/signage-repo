"use client";

import { useState } from "react";
import { Dialog } from "@headlessui/react";
import { Globe, X } from "lucide-react";

interface AddWebsiteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (data: { name: string; url: string; duration: number; cacheForOffline: boolean }) => Promise<void>;
}

export default function AddWebsiteModal({ isOpen, onClose, onAdd }: AddWebsiteModalProps) {
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [duration, setDuration] = useState(15);
    const [cacheForOffline, setCacheForOffline] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!name.trim()) {
            setError("Name is required");
            return;
        }

        if (!url.trim() || !url.startsWith("http")) {
            setError("Valid URL required (must start with http:// or https://)");
            return;
        }

        try {
            setLoading(true);
            // Default duration 10s (user configures in playlist)
            await onAdd({ name, url, duration: 10, cacheForOffline });
            onClose();
            // Reset form
            setName("");
            setUrl("");
            setDuration(15);
            setCacheForOffline(false);
        } catch (err) {
            setError("Failed to add website");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                        <Dialog.Title className="text-lg font-medium text-gray-900 flex items-center gap-2">
                            <Globe className="h-5 w-5 text-indigo-600" />
                            Add Website
                        </Dialog.Title>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Corporate Dashboard"
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">URL</label>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://..."
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>



                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="offline-mode"
                                checked={cacheForOffline}
                                onChange={(e) => setCacheForOffline(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="offline-mode" className="text-sm text-gray-700">
                                Save for offline presentation
                            </label>
                        </div>
                        <p className="text-xs text-gray-500 ml-6">
                            If checked, player attempts to load from cache when offline. Otherwise, it skips.
                        </p>

                        {error && <p className="text-sm text-red-600">{error}</p>}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                            >
                                {loading ? "Adding..." : "Add Website"}
                            </button>
                        </div>
                    </form>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
}
