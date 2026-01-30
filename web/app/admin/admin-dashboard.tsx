
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Users,
    Monitor,
    HardDrive,
    StopCircle,
    CheckCircle,
    AlertCircle
} from "lucide-react";
import { useToast } from "@/components/ui/toast-context";

type UserStats = {
    id: string;
    name: string | null;
    email: string;
    role: "USER" | "ADMIN";
    isActive: boolean;
    deviceCount: number;
    playlistCount: number;
    storageUsed: number; // in bytes
    createdAt: string;
};

export default function AdminDashboard({ users }: { users: UserStats[] }) {
    const router = useRouter();
    const { showToast } = useToast();
    const [loadingId, setLoadingId] = useState<string | null>(null);

    // Calculate Platform Stats
    const totalUsers = users.length;
    const totalDevices = users.reduce((acc, u) => acc + u.deviceCount, 0);
    const totalStorage = users.reduce((acc, u) => acc + u.storageUsed, 0);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const toggleUserStatus = async (user: UserStats) => {
        if (!confirm(`Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} ${user.name || user.email}?`)) return;

        setLoadingId(user.id);
        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !user.isActive }),
            });

            if (!res.ok) {
                const err = await res.json();
                showToast(err.error || "Failed to update user", "error");
            } else {
                router.refresh();
            }
        } catch (error) {
            showToast("An error occurred", "error");
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="space-y-8">
            {/* Platform Stats Row */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                            <Users className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                                <dd className="text-lg font-medium text-gray-900">{totalUsers}</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                            <Monitor className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">Active Players</dt>
                                <dd className="text-lg font-medium text-gray-900">{totalDevices}</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                            <HardDrive className="h-6 w-6 text-white" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">Total Storage Used</dt>
                                <dd className="text-lg font-medium text-gray-900">{formatBytes(totalStorage)}</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">User Management</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stats</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {users.map((user) => (
                                <tr key={user.id} className={!user.isActive ? "bg-red-50" : ""}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-500">
                                                    {(user.name || user.email)[0].toUpperCase()}
                                                </div>
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{user.name || "No Name"}</div>
                                                <div className="text-sm text-gray-500">{user.email}</div>
                                                <div className="text-xs text-gray-400">Joined {new Date(user.createdAt).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {user.isActive ? (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                Inactive
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex flex-col gap-1">
                                            <span title="Devices">🖥️ {user.deviceCount}</span>
                                            <span title="Playlists">📋 {user.playlistCount}</span>
                                            <span title="Storage">💾 {formatBytes(user.storageUsed)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {user.role !== "ADMIN" && (
                                            <button
                                                onClick={() => toggleUserStatus(user)}
                                                disabled={loadingId === user.id}
                                                className={`
                                                    inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2
                                                    ${user.isActive
                                                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                                                        : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                                                    } 
                                                    ${loadingId === user.id ? 'opacity-50 cursor-wait' : ''}
                                                `}
                                            >
                                                {loadingId === user.id ? 'Saving...' : (user.isActive ? 'Deactivate' : 'Activate')}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
