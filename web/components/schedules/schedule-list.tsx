"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { format } from "date-fns";
import { MoreHorizontal, Trash, Edit } from "lucide-react";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ScheduleList() {
    const { data: schedules, error, mutate } = useSWR("/api/schedules", fetcher);
    const router = useRouter();

    if (error) return <div>Failed to load schedules</div>;
    if (!schedules) return <div>Loading...</div>;

    if (schedules.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-gray-500 mb-4">You haven't created any schedules yet.</p>
            </div>
        );
    }

    const deleteSchedule = async (id: string) => {
        if (!confirm("Are you sure you want to delete this schedule?")) return;

        await fetch(`/api/schedules/${id}`, { method: "DELETE" });
        mutate();
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Devices
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Updated
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {schedules.map((schedule: any) => (
                        <tr key={schedule.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <Link
                                    href={`/dashboard/schedules/${schedule.id}`}
                                    className="text-indigo-600 hover:text-indigo-900 font-medium"
                                >
                                    {schedule.name}
                                </Link>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {schedule._count?.devices || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {format(new Date(schedule.updatedAt), "MMM d, yyyy")}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                    onClick={() => deleteSchedule(schedule.id)}
                                    className="text-red-600 hover:text-red-900 ml-4"
                                >
                                    <Trash className="h-4 w-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
