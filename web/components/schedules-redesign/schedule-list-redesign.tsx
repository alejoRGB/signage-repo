"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { format } from "date-fns";
import { Trash } from "lucide-react";
import ConfirmModal from "@/components/confirm-modal";
import { useToast } from "@/components/ui/toast-context";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ScheduleListRedesign() {
  const { data: schedules, error, mutate } = useSWR("/api/schedules", fetcher);
  const { showToast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (error) return <div>Failed to load schedules</div>;
  if (!schedules) return <div>Loading...</div>;

  if (schedules.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="mb-4 text-gray-500">You haven't created any schedules yet.</p>
      </div>
    );
  }

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      await fetch(`/api/schedules/${deleteId}`, { method: "DELETE" });
      mutate();
      showToast("Schedule deleted successfully", "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to delete schedule", "error");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Devices</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Last Updated</th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {schedules.map((schedule: any) => (
            <tr key={schedule.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-6 py-4">
                <Link href={`/dashboard/schedules-redesign/${schedule.id}`} className="font-medium text-indigo-600 hover:text-indigo-900">
                  {schedule.name}
                </Link>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{schedule._count?.devices || 0}</td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{format(new Date(schedule.updatedAt), "MMM d, yyyy")}</td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                <button onClick={() => handleDeleteClick(schedule.id)} className="ml-4 text-red-600 hover:text-red-900">
                  <Trash className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete Schedule"
        message="Are you sure you want to delete this schedule? This action cannot be undone."
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
}
