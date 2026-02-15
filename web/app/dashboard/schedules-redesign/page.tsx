"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Plus } from "lucide-react";
import CreateScheduleModal from "@/components/schedules/create-schedule-modal";
import ScheduleListRedesign from "@/components/schedules-redesign/schedule-list-redesign";

export default function SchedulesRedesignPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { mutate } = useSWRConfig();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedules (Redesign Sandbox)</h1>
          <p className="text-sm text-gray-500">Experimental route. Production schedules remain unchanged.</p>
        </div>
        <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
          <Plus className="h-4 w-4" />
          Create Schedule
        </button>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <ScheduleListRedesign />
      </div>

      <CreateScheduleModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreated={() => mutate("/api/schedules")} />
    </div>
  );
}
