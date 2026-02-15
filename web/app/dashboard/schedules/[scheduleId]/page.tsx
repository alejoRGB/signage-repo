"use client";

import { use } from "react";
import ScheduleEditor from "@/components/schedules/schedule-editor";
import ScheduleGridEditor from "@/components/schedules-redesign/schedule-grid-editor";

const schedulesRedesignEnabled = process.env.NEXT_PUBLIC_SCHEDULES_REDESIGN_ENABLED === "true";

export default function ScheduleEditorPage({ params }: { params: Promise<{ scheduleId: string }> }) {
    const { scheduleId } = use(params);

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Edit Schedule</h1>
            </div>

            <div className="flex-1 bg-white shadow rounded-lg overflow-hidden flex flex-col">
                {schedulesRedesignEnabled ? (
                    <ScheduleGridEditor scheduleId={scheduleId} />
                ) : (
                    <ScheduleEditor scheduleId={scheduleId} />
                )}
            </div>
        </div>
    );
}
