"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ScheduleGridEditor from "@/components/schedules-redesign/schedule-grid-editor";

export default function ScheduleRedesignEditorPage({ params }: { params: Promise<{ scheduleId: string }> }) {
  const { scheduleId } = use(params);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Edit Schedule (Redesign Sandbox)</h1>
        <Link href="/dashboard/schedules-redesign" className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />
          Back to List
        </Link>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg bg-white shadow">
        <ScheduleGridEditor scheduleId={scheduleId} />
      </div>
    </div>
  );
}
