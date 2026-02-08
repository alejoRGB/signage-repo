"use client";

import useSWR from "swr";
import Link from "next/link";
import { format } from "date-fns";
import { MoreHorizontal, Trash, Edit, Calendar, Clock, Monitor } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-context";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ScheduleList() {
    const { data: schedules, error, mutate } = useSWR("/api/schedules", fetcher);
    const router = useRouter();
    const { showToast } = useToast();

    if (error) return <div className="text-red-500">Failed to load schedules</div>;
    if (!schedules) return <div className="text-muted-foreground">Loading...</div>;

    if (schedules.length === 0) {
        return (
            <div className="text-center py-12 bg-card rounded-lg border-2 border-dashed border-border">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-2 text-sm font-medium text-foreground">No schedules</h3>
                <p className="mt-1 text-sm text-muted-foreground">Create a schedule to define when content plays.</p>
            </div>
        );
    }

    const deleteSchedule = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        if (!confirm("Are you sure you want to delete this schedule?")) return;

        try {
            await fetch(`/api/schedules/${id}`, { method: "DELETE" });
            mutate();
            showToast("Schedule deleted", "success");
        } catch (err) {
            showToast("Failed to delete schedule", "error");
        }
    };

    return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {schedules.map((schedule: any) => (
                <Link
                    key={schedule.id}
                    href={`/dashboard/schedules/${schedule.id}`}
                    className="group relative bg-card border border-border rounded-xl overflow-hidden shadow-none hover:border-primary/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all duration-300 block"
                >
                    <div className="p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                                <Calendar className="h-6 w-6" />
                            </div>
                            <button
                                onClick={(e) => deleteSchedule(schedule.id, e)}
                                className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash className="h-5 w-5" />
                            </button>
                        </div>

                        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors tracking-tight">
                            {schedule.name}
                        </h3>

                        <div className="mt-4 space-y-2">
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Monitor className="h-4 w-4 mr-2 text-muted-foreground/70" />
                                {schedule._count?.devices || 0} devices
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Clock className="h-4 w-4 mr-2 text-muted-foreground/70" />
                                Updated {format(new Date(schedule.updatedAt), "MMM d, yyyy")}
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/5 px-5 py-3 border-t border-white/5 flex justify-between items-center">
                        <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                            Weekly Schedule
                        </span>
                        <span className="text-xs font-medium text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Edit Schedule <Edit className="h-3 w-3" />
                        </span>
                    </div>
                </Link>
            ))}
        </div>
    );
}
