
import React, { useState, useEffect } from "react";
import { Device } from "@/types/device";

type DeviceLogsModalProps = {
    device: Device | null;
    isOpen: boolean;
    onClose: () => void;
};

type LogEntry = {
    id: string;
    level: string;
    message: string;
    event?: string | null;
    sessionId?: string | null;
    data?: Record<string, unknown> | null;
    timestamp: string;
};

export default function DeviceLogsModal({ device, isOpen, onClose }: DeviceLogsModalProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !device) {
            setLogs([]);
            return;
        }

        const fetchLogs = async () => {
            // Only set loading on initial fetch if logs are empty
            if (logs.length === 0) setLoading(true);
            try {
                const res = await fetch(`/api/devices/${device.id}/logs`);
                if (res.ok) {
                    const data = await res.json();
                    setLogs(data.events || []);
                }
            } catch (error) {
                console.error("Logs auto-refresh failed", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs(); // Fetch immediately
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [isOpen, device]);

    if (!isOpen || !device) return null;

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Device Logs - {device.name}
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {loading && logs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            Loading logs...
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No logs recorded for this device.
                        </div>
                    ) : (
                        <div className="space-y-2 font-mono text-sm">
                            {logs.map((log) => (
                                <div key={log.id} className="bg-white border border-gray-200 rounded p-3 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-start gap-3">
                                        <span className={`shrink-0 px-2 py-0.5 text-xs font-bold rounded uppercase ${getLogLevelColor(log.level)}`}>
                                            {log.level}
                                        </span>
                                        <span className="shrink-0 text-gray-500 text-xs mt-0.5" suppressHydrationWarning>
                                            {new Date(log.timestamp).toLocaleString("es-AR", {
                                                timeZone: "UTC",
                                                hour12: false
                                            })}
                                        </span>
                                        <div className="text-gray-900 break-all whitespace-pre-wrap">
                                            {log.message}
                                            {log.event ? (
                                                <div className="mt-1 text-xs text-indigo-700">
                                                    event: {log.event}
                                                </div>
                                            ) : null}
                                            {log.sessionId ? (
                                                <div className="mt-1 text-xs text-gray-500">
                                                    session: {log.sessionId}
                                                </div>
                                            ) : null}
                                            {log.data && Object.keys(log.data).length > 0 ? (
                                                <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 text-xs text-slate-700">
                                                    {JSON.stringify(log.data, null, 2)}
                                                </pre>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-200 bg-white rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
