"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Eraser, Loader2, Paintbrush, Save } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import type { ScheduleItem } from "@/types/schedule";

type Playlist = {
  id: string;
  name: string;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_COUNT = 48; // 30-min blocks in 24h
const PALETTE = [
  "bg-rose-300 border-rose-400",
  "bg-orange-300 border-orange-400",
  "bg-amber-300 border-amber-400",
  "bg-lime-300 border-lime-400",
  "bg-emerald-300 border-emerald-400",
  "bg-cyan-300 border-cyan-400",
  "bg-sky-300 border-sky-400",
  "bg-blue-300 border-blue-400",
  "bg-indigo-300 border-indigo-400",
  "bg-violet-300 border-violet-400",
  "bg-fuchsia-300 border-fuchsia-400",
  "bg-pink-300 border-pink-400",
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getPlaylistColorClass(playlistId: string): string {
  return PALETTE[hashString(playlistId) % PALETTE.length];
}

function toSlotIndex(time: string, mode: "floor" | "ceil"): number {
  const [h, m] = time.split(":").map(Number);
  const minutes = h * 60 + m;
  const slotRaw = minutes / 30;
  const slot = mode === "floor" ? Math.floor(slotRaw) : Math.ceil(slotRaw);
  return Math.max(0, Math.min(SLOT_COUNT, slot));
}

function slotToTime(slot: number): string {
  const minutes = slot * 30;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function rowLabel(row: number): string {
  const minutes = row * 30;
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function itemsToGrid(items: ScheduleItem[]): (string | null)[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: SLOT_COUNT }, () => null as string | null));
  for (const item of items) {
    const start = toSlotIndex(item.startTime, "floor");
    const endRaw = item.endTime === "23:59" ? SLOT_COUNT : toSlotIndex(item.endTime, "ceil");
    const end = Math.max(start + 1, Math.min(SLOT_COUNT, endRaw));
    for (let slot = start; slot < end; slot += 1) {
      grid[item.dayOfWeek][slot] = item.playlistId;
    }
  }
  return grid;
}

function gridToItems(grid: (string | null)[][]): ScheduleItem[] {
  const result: ScheduleItem[] = [];
  for (let day = 0; day < 7; day += 1) {
    let start = 0;
    while (start < SLOT_COUNT) {
      const playlistId = grid[day][start];
      if (!playlistId) {
        start += 1;
        continue;
      }

      let end = start + 1;
      while (end < SLOT_COUNT && grid[day][end] === playlistId) {
        end += 1;
      }

      result.push({
        dayOfWeek: day,
        startTime: slotToTime(start),
        endTime: end >= SLOT_COUNT ? "23:59" : slotToTime(end),
        playlistId,
      });
      start = end;
    }
  }
  return result;
}

export default function ScheduleGridEditor({ scheduleId }: { scheduleId: string }) {
  const { data: schedule, error } = useSWR(`/api/schedules/${scheduleId}`, fetcher);
  const { data: playlists } = useSWR<Playlist[]>("/api/playlists", fetcher);
  const { mutate } = useSWRConfig();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [grid, setGrid] = useState<(string | null)[][]>(Array.from({ length: 7 }, () => Array.from({ length: SLOT_COUNT }, () => null)));
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [eraserMode, setEraserMode] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [mobileDay, setMobileDay] = useState(1);

  useEffect(() => {
    if (!schedule) return;
    setName(schedule.name ?? "");
    setGrid(itemsToGrid(schedule.items ?? []));
    setIsDirty(false);
  }, [schedule]);

  useEffect(() => {
    if (!playlists?.length) return;
    if (!selectedPlaylistId) {
      setSelectedPlaylistId(playlists[0].id);
    }
  }, [playlists, selectedPlaylistId]);

  useEffect(() => {
    const stopPainting = () => setIsPainting(false);
    window.addEventListener("mouseup", stopPainting);
    return () => window.removeEventListener("mouseup", stopPainting);
  }, []);

  const playlistById = useMemo(() => {
    const map = new Map<string, Playlist>();
    for (const p of playlists ?? []) {
      map.set(p.id, p);
    }
    return map;
  }, [playlists]);

  const applyCell = (day: number, slot: number) => {
    const paintValue = eraserMode ? null : selectedPlaylistId || null;
    if (!eraserMode && !paintValue) return;

    setGrid((prev) => {
      if (prev[day][slot] === paintValue) return prev;
      const next = prev.map((row) => [...row]);
      next[day][slot] = paintValue;
      return next;
    });
    setIsDirty(true);
  };

  const handleMouseDownCell = (day: number, slot: number) => {
    applyCell(day, slot);
    setIsPainting(true);
  };

  const handleMouseEnterCell = (day: number, slot: number) => {
    if (!isPainting) return;
    applyCell(day, slot);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = gridToItems(grid);
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, items }),
      });

      if (!res.ok) {
        showToast("Failed to save schedule.", "error");
        return;
      }

      await mutate(`/api/schedules/${scheduleId}`);
      setIsDirty(false);
      showToast("Schedule saved successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Error saving schedule.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <div>Failed to load</div>;
  if (!schedule || !playlists) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4">
        <div className="flex min-w-0 flex-col">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setIsDirty(true);
            }}
            className="w-full border-none bg-transparent text-lg font-bold text-gray-900 focus:outline-none"
          />
          <span className="text-xs text-gray-500">Grid editor (30-minute blocks). Browser local time.</span>
        </div>

        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[220px_1fr]">
        <aside className="min-h-0 overflow-y-auto border-r bg-white p-4 lg:p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Playlists</h3>
            <p className="text-xs text-gray-500">Click a playlist, then click + drag on the calendar.</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => setEraserMode(false)}
              className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                !eraserMode ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <Paintbrush className="h-4 w-4" />
              Paint Mode
            </button>
            <button
              onClick={() => setEraserMode(true)}
              className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                eraserMode ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <Eraser className="h-4 w-4" />
              Eraser Mode
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {playlists.map((playlist) => {
              const selected = selectedPlaylistId === playlist.id;
              const color = getPlaylistColorClass(playlist.id);
              return (
                <button
                  key={playlist.id}
                  onClick={() => {
                    setSelectedPlaylistId(playlist.id);
                    setEraserMode(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                    selected && !eraserMode ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <span className={`h-3 w-3 rounded-sm border ${color}`} />
                  <span className="truncate text-gray-900">{playlist.name}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium text-gray-700">Legend</p>
            <div className="space-y-1">
              {playlists.map((playlist) => (
                <div key={playlist.id} className="flex items-center gap-2 text-xs text-gray-700">
                  <span className={`h-2.5 w-2.5 rounded-sm border ${getPlaylistColorClass(playlist.id)}`} />
                  <span className="truncate">{playlist.name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto overflow-x-hidden bg-gray-100 p-2 lg:p-3">
          <div className="mb-3 flex items-center gap-2 lg:hidden">
            <label htmlFor="mobile-day" className="text-xs font-medium text-gray-700">
              Day
            </label>
            <select
              id="mobile-day"
              value={mobileDay}
              onChange={(e) => setMobileDay(Number(e.target.value))}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
            >
              {DAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white lg:block">
            <table className="w-full table-fixed border-collapse select-none text-[11px]">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 w-14 border-b border-r bg-gray-100 px-1 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                    Time
                  </th>
                  {DAYS.map((day, index) => (
                    <th
                      key={day}
                      title={day}
                      className="sticky top-0 z-20 border-b border-r bg-gray-100 px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-600"
                    >
                      {DAY_SHORT[index]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: SLOT_COUNT }).map((_, slot) => (
                  <tr key={slot}>
                    <td className="sticky left-0 z-10 border-b border-r bg-gray-50 px-1 py-0 text-[9px] leading-none text-gray-600">
                      {rowLabel(slot)}
                    </td>
                    {Array.from({ length: 7 }).map((__, day) => {
                      const playlistId = grid[day][slot];
                      const colorClass = playlistId ? getPlaylistColorClass(playlistId) : "bg-white";
                      const isActiveSelection = !eraserMode && playlistId && playlistId === selectedPlaylistId;
                      return (
                        <td
                          key={`${day}-${slot}`}
                          onMouseDown={() => handleMouseDownCell(day, slot)}
                          onMouseEnter={() => handleMouseEnterCell(day, slot)}
                          className={`h-3 border-b border-r px-1 transition-colors ${colorClass} ${
                            isActiveSelection ? "ring-1 ring-inset ring-indigo-500" : ""
                          } cursor-crosshair`}
                          title={playlistId ? `${DAYS[day]} ${rowLabel(slot)} - ${playlistById.get(playlistId)?.name ?? "Playlist"}` : `${DAYS[day]} ${rowLabel(slot)}`}
                        />
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="sticky left-0 z-10 border-r bg-gray-100 px-1 py-0.5 text-[10px] font-semibold text-gray-700">24:00</td>
                  {Array.from({ length: 7 }).map((_, day) => (
                    <td key={`end-${day}`} className="h-3 border-r bg-gray-100" />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white lg:hidden">
            <table className="w-full border-collapse select-none">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 w-24 border-b border-r bg-gray-100 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Time
                  </th>
                  <th className="sticky top-0 z-20 border-b border-r bg-gray-100 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {DAYS[mobileDay]}
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: SLOT_COUNT }).map((_, slot) => {
                  const playlistId = grid[mobileDay][slot];
                  const colorClass = playlistId ? getPlaylistColorClass(playlistId) : "bg-white";
                  const isActiveSelection = !eraserMode && playlistId && playlistId === selectedPlaylistId;
                  return (
                    <tr key={`${mobileDay}-${slot}`}>
                      <td className="sticky left-0 z-10 border-b border-r bg-gray-50 px-2 py-1 text-xs text-gray-600">{rowLabel(slot)}</td>
                      <td
                        onMouseDown={() => handleMouseDownCell(mobileDay, slot)}
                        onMouseEnter={() => handleMouseEnterCell(mobileDay, slot)}
                        className={`h-8 border-b border-r px-1 transition-colors ${colorClass} ${
                          isActiveSelection ? "ring-1 ring-inset ring-indigo-500" : ""
                        } cursor-crosshair`}
                        title={playlistId ? `${DAYS[mobileDay]} ${rowLabel(slot)} - ${playlistById.get(playlistId)?.name ?? "Playlist"}` : `${DAYS[mobileDay]} ${rowLabel(slot)}`}
                      />
                    </tr>
                  );
                })}
                <tr>
                  <td className="sticky left-0 z-10 border-r bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">24:00</td>
                  <td className="h-3 border-r bg-gray-100" />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
