"use client";

import { useState } from "react";
import ScheduleList from "@/components/schedules/schedule-list";
import CreateScheduleModal from "@/components/schedules/create-schedule-modal";
import { Plus } from "lucide-react";
import { useSWRConfig } from "swr";

export default function SchedulesPage() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const { mutate } = useSWRConfig();

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                >
                    <Plus className="h-4 w-4" />
                    Create Schedule
                </button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <ScheduleList />
            </div>

            <CreateScheduleModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreated={() => mutate("/api/schedules")}
            />
        </div>
    );
}
