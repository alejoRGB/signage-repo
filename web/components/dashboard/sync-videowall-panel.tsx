"use client";

import { useEffect, useMemo, useState } from "react";
import { GripVertical, Monitor, Play, Plus, Save, Square, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { DIRECTIVE_TAB, type DirectiveTab } from "@/lib/directive-tabs";
import { SYNC_PRESET_MODE, type SyncPresetMode } from "@/types/sync";

type SyncDevice = {
    id: string;
    name: string;
    connectivityStatus?: string;
    status?: string;
};

type SyncMediaItem = {
    id: string;
    name: string;
    type: "image" | "video" | "web";
    durationMs?: number | null;
};

type SyncPresetDevice = {
    deviceId: string;
    mediaItemId?: string | null;
};

type SyncPreset = {
    id: string;
    name: string;
    mode: SyncPresetMode;
    durationMs: number;
    presetMediaId?: string | null;
    devices: SyncPresetDevice[];
};

type ActiveSessionDevice = {
    id: string;
    deviceId: string;
    status: string;
    lastSeenAt?: string | null;
    resyncCount?: number | null;
    clockOffsetMs?: number | null;
    healthScore?: number | null;
    avgDriftMs?: number | null;
    maxDriftMs?: number | null;
    resyncRate?: number | null;
    device: {
        id: string;
        name: string;
        status?: string | null;
    };
};

type ActiveSession = {
    id: string;
    status: string;
    presetId: string;
    masterDeviceId?: string | null;
    devices: ActiveSessionDevice[];
};

type DragOrigin = "available" | "sync";
type WizardStep = 1 | 2 | 3;

type ValidationResult =
    | { valid: false; error: string }
    | { valid: true; durationMs: number };

type SyncVideowallPanelProps = {
    activeDirectiveTab: DirectiveTab;
};

const SYNC_STATUS_LABELS: Record<string, string> = {
    ASSIGNED: "assigned",
    PRELOADING: "preloading",
    READY: "ready",
    WARMING_UP: "warming_up",
    PLAYING: "playing",
    ERRORED: "errored",
    DISCONNECTED: "disconnected",
};

function statusClass(status: string) {
    switch (status) {
        case "PLAYING":
            return "bg-emerald-100 text-emerald-900";
        case "READY":
        case "WARMING_UP":
        case "PRELOADING":
            return "bg-cyan-100 text-cyan-900";
        case "ERRORED":
            return "bg-rose-100 text-rose-900";
        case "DISCONNECTED":
            return "bg-slate-200 text-slate-700";
        default:
            return "bg-slate-100 text-slate-700";
    }
}

function msToSecondsLabel(ms: number) {
    if (ms % 1000 === 0) {
        return `${ms / 1000}s`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
}

function heartbeatAgeLabel(lastSeenAt?: string | null) {
    if (!lastSeenAt) {
        return "n/a";
    }

    const parsedMs = Date.parse(lastSeenAt);
    if (Number.isNaN(parsedMs)) {
        return "n/a";
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - parsedMs) / 1000));
    if (elapsedSeconds < 60) {
        return `${elapsedSeconds}s ago`;
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    return `${elapsedMinutes}m ago`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const errorMessage =
            (payload && typeof payload === "object" && "error" in payload
                ? (payload as { error?: string }).error
                : null) ?? "Request failed";
        throw new Error(errorMessage);
    }
    return payload as T;
}

export function SyncVideowallPanel({ activeDirectiveTab }: SyncVideowallPanelProps) {
    const { showToast } = useToast();
    const [devices, setDevices] = useState<SyncDevice[]>([]);
    const [mediaItems, setMediaItems] = useState<SyncMediaItem[]>([]);
    const [presets, setPresets] = useState<SyncPreset[]>([]);
    const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

    const [presetName, setPresetName] = useState("");
    const [selectedPresetId, setSelectedPresetId] = useState<string>("");
    const [mode, setMode] = useState<SyncPresetMode>(SYNC_PRESET_MODE.COMMON);
    const [commonMediaId, setCommonMediaId] = useState<string>("");
    const [syncDeviceIds, setSyncDeviceIds] = useState<string[]>([]);
    const [assignedMediaByDevice, setAssignedMediaByDevice] = useState<Record<string, string>>({});
    const [wizardStep, setWizardStep] = useState<WizardStep>(1);
    const [draggedDeviceId, setDraggedDeviceId] = useState<string | null>(null);
    const [dragOrigin, setDragOrigin] = useState<DragOrigin | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSavingPreset, setIsSavingPreset] = useState(false);
    const [isDeletingPreset, setIsDeletingPreset] = useState(false);
    const [isStartingSession, setIsStartingSession] = useState(false);
    const [isStoppingSession, setIsStoppingSession] = useState(false);

    const deviceById = useMemo(
        () =>
            devices.reduce<Record<string, SyncDevice>>((acc, device) => {
                acc[device.id] = device;
                return acc;
            }, {}),
        [devices]
    );

    const videoMediaItems = useMemo(
        () => mediaItems.filter((media) => media.type === "video"),
        [mediaItems]
    );

    const videoMediaById = useMemo(
        () =>
            videoMediaItems.reduce<Record<string, SyncMediaItem>>((acc, media) => {
                acc[media.id] = media;
                return acc;
            }, {}),
        [videoMediaItems]
    );

    const availableDevices = useMemo(
        () => devices.filter((device) => !syncDeviceIds.includes(device.id)),
        [devices, syncDeviceIds]
    );

    const syncDevices = useMemo(
        () => syncDeviceIds.map((id) => deviceById[id]).filter(Boolean) as SyncDevice[],
        [syncDeviceIds, deviceById]
    );

    const perDeviceDurationLockMs = useMemo(() => {
        for (const deviceId of syncDeviceIds) {
            const mediaId = assignedMediaByDevice[deviceId];
            if (!mediaId) {
                continue;
            }
            const media = videoMediaById[mediaId];
            if (media && typeof media.durationMs === "number") {
                return media.durationMs;
            }
        }
        return null;
    }, [syncDeviceIds, assignedMediaByDevice, videoMediaById]);

    const durationLockMs = useMemo(() => {
        if (mode === SYNC_PRESET_MODE.COMMON) {
            const media = videoMediaById[commonMediaId];
            return media && typeof media.durationMs === "number" ? media.durationMs : null;
        }
        return perDeviceDurationLockMs;
    }, [mode, commonMediaId, perDeviceDurationLockMs, videoMediaById]);

    const selectedPreset = useMemo(
        () => presets.find((preset) => preset.id === selectedPresetId) ?? null,
        [presets, selectedPresetId]
    );

    const isDirectiveActive = activeDirectiveTab === DIRECTIVE_TAB.SYNC_VIDEOWALL;
    const canProceedFromStep1 = syncDeviceIds.length >= 2;

    const assignmentValidation = useMemo<ValidationResult>(() => {
        if (syncDeviceIds.length < 2) {
            return { valid: false, error: "Select at least 2 devices" };
        }

        if (mode === SYNC_PRESET_MODE.COMMON) {
            if (!commonMediaId) {
                return { valid: false, error: "Select the common video for all devices" };
            }
            const media = videoMediaById[commonMediaId];
            if (!media || media.type !== "video") {
                return { valid: false, error: "Sync only supports video media" };
            }
            if (typeof media.durationMs !== "number") {
                return { valid: false, error: "Selected video must include durationMs" };
            }
            return { valid: true, durationMs: media.durationMs };
        }

        const durations = new Set<number>();
        for (const deviceId of syncDeviceIds) {
            const assignedMediaId = assignedMediaByDevice[deviceId];
            if (!assignedMediaId) {
                const deviceName = deviceById[deviceId]?.name ?? deviceId;
                return { valid: false, error: `Assign a video for ${deviceName}` };
            }

            const media = videoMediaById[assignedMediaId];
            if (!media || media.type !== "video") {
                return { valid: false, error: "Sync only supports video media" };
            }

            if (typeof media.durationMs !== "number") {
                return { valid: false, error: "All assigned videos must include durationMs" };
            }

            durations.add(media.durationMs);
        }

        if (durations.size !== 1) {
            return { valid: false, error: "All per-device videos must have exactly the same durationMs" };
        }

        return { valid: true, durationMs: [...durations][0] };
    }, [assignedMediaByDevice, commonMediaId, deviceById, mode, syncDeviceIds, videoMediaById]);

    const canProceedFromStep2 = assignmentValidation.valid;

    const refreshActiveSession = async () => {
        try {
            const active = await fetchJson<{ session: ActiveSession | null }>("/api/sync/session/active", {
                cache: "no-store",
            });
            setActiveSession(active.session ?? null);
        } catch {
            setActiveSession(null);
        }
    };

    const refreshBuilderData = async () => {
        setIsLoading(true);
        try {
            const [devicesData, mediaData, presetsData] = await Promise.all([
                fetchJson<SyncDevice[]>("/api/devices?order=created_asc"),
                fetchJson<SyncMediaItem[]>("/api/media"),
                fetchJson<SyncPreset[]>("/api/sync/presets"),
            ]);

            setDevices(Array.isArray(devicesData) ? devicesData : []);
            setMediaItems(Array.isArray(mediaData) ? mediaData : []);
            setPresets(Array.isArray(presetsData) ? presetsData : []);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to load Sync panel data");
            setDevices([]);
            setMediaItems([]);
            setPresets([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let disposed = false;

        const load = async () => {
            await Promise.all([refreshBuilderData(), refreshActiveSession()]);
        };

        void load().catch(() => undefined);

        const intervalId = window.setInterval(() => {
            if (!disposed) {
                void refreshActiveSession();
            }
        }, 1500);

        return () => {
            disposed = true;
            window.clearInterval(intervalId);
        };
    }, []);

    const hydrateEditorFromPreset = (preset: SyncPreset | null) => {
        if (!preset) {
            setPresetName("");
            setMode(SYNC_PRESET_MODE.COMMON);
            setCommonMediaId("");
            setSyncDeviceIds([]);
            setAssignedMediaByDevice({});
            return;
        }

        setPresetName(preset.name);
        setMode(preset.mode);
        setCommonMediaId(preset.presetMediaId ?? "");
        setSyncDeviceIds(preset.devices.map((item) => item.deviceId));
        setAssignedMediaByDevice(
            preset.devices.reduce<Record<string, string>>((acc, item) => {
                if (item.mediaItemId) {
                    acc[item.deviceId] = item.mediaItemId;
                }
                return acc;
            }, {})
        );
    };

    useEffect(() => {
        if (presets.length === 0) {
            if (selectedPresetId !== "") {
                setSelectedPresetId("");
            }
            return;
        }

        if (!selectedPresetId || !presets.some((preset) => preset.id === selectedPresetId)) {
            setSelectedPresetId(presets[0].id);
        }
    }, [presets, selectedPresetId]);

    useEffect(() => {
        hydrateEditorFromPreset(selectedPreset);
    }, [selectedPresetId, selectedPreset]);

    const isDeviceOnline = (device: SyncDevice) => {
        const status = (device.connectivityStatus ?? device.status ?? "offline").toLowerCase();
        return status === "online";
    };

    const getDeviceStatus = (device: SyncDevice) => {
        return isDeviceOnline(device) ? "Online" : "Offline";
    };

    const offlineSyncDevices = useMemo(
        () => syncDevices.filter((device) => !isDeviceOnline(device)),
        [syncDevices]
    );

    const reviewRows = useMemo(
        () =>
            syncDevices.map((device) => {
                const assignedMediaId =
                    mode === SYNC_PRESET_MODE.COMMON ? commonMediaId || null : assignedMediaByDevice[device.id] ?? null;
                const media = assignedMediaId ? videoMediaById[assignedMediaId] ?? null : null;
                return {
                    deviceId: device.id,
                    deviceName: device.name,
                    isOnline: isDeviceOnline(device),
                    mediaName: media?.name ?? "Not assigned",
                    durationMs: typeof media?.durationMs === "number" ? media.durationMs : null,
                };
            }),
        [assignedMediaByDevice, commonMediaId, mode, syncDevices, videoMediaById]
    );

    const addDeviceToSync = (deviceId: string) => {
        setSyncDeviceIds((current) => (current.includes(deviceId) ? current : [...current, deviceId]));
    };

    const removeDeviceFromSync = (deviceId: string) => {
        setSyncDeviceIds((current) => current.filter((id) => id !== deviceId));
        setAssignedMediaByDevice((current) => {
            const next = { ...current };
            delete next[deviceId];
            return next;
        });
    };

    const handleDropOnSync = () => {
        if (!draggedDeviceId) {
            return;
        }
        if (dragOrigin === "available") {
            addDeviceToSync(draggedDeviceId);
        }
        setDraggedDeviceId(null);
        setDragOrigin(null);
    };

    const handleDropOnAvailable = () => {
        if (!draggedDeviceId) {
            return;
        }
        if (dragOrigin === "sync") {
            removeDeviceFromSync(draggedDeviceId);
        }
        setDraggedDeviceId(null);
        setDragOrigin(null);
    };

    const goToNextStep = () => {
        if (wizardStep === 1 && !canProceedFromStep1) {
            const message = "Select at least 2 devices to continue";
            setErrorMessage(message);
            showToast(message, "error");
            return;
        }

        if (wizardStep === 2 && !canProceedFromStep2) {
            const message = assignmentValidation.valid
                ? "Complete video assignments to continue"
                : assignmentValidation.error;
            setErrorMessage(message);
            showToast(message, "error");
            return;
        }

        setErrorMessage(null);
        setWizardStep((current) => (current >= 3 ? 3 : ((current + 1) as WizardStep)));
    };

    const goToPreviousStep = () => {
        setErrorMessage(null);
        setWizardStep((current) => (current <= 1 ? 1 : ((current - 1) as WizardStep)));
    };

    const openSavedPreset = (presetId: string) => {
        setSelectedPresetId(presetId);
        setWizardStep(3);
        setErrorMessage(null);
    };

    const validatePresetDraft = (): ValidationResult => {
        const trimmedName = presetName.trim();
        if (!trimmedName) {
            return { valid: false, error: "Preset name is required" };
        }
        return assignmentValidation;
    };

    const savePreset = async (options?: { forceCreate?: boolean }) => {
        const forceCreate = options?.forceCreate ?? false;
        setErrorMessage(null);
        const validation = validatePresetDraft();
        if (!validation.valid) {
            setErrorMessage(validation.error);
            showToast(validation.error, "error");
            return;
        }

        const payload = {
            name: presetName.trim(),
            mode,
            durationMs: validation.durationMs,
            presetMediaId: mode === SYNC_PRESET_MODE.COMMON ? commonMediaId : null,
            devices: syncDeviceIds.map((deviceId) => ({
                deviceId,
                mediaItemId: mode === SYNC_PRESET_MODE.PER_DEVICE ? assignedMediaByDevice[deviceId] : null,
            })),
        };

        setIsSavingPreset(true);
        try {
            if (selectedPresetId && !forceCreate) {
                const updated = await fetchJson<SyncPreset>(`/api/sync/presets/${selectedPresetId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                setPresets((current) => current.map((preset) => (preset.id === updated.id ? updated : preset)));
                showToast("Sync preset updated", "success");
            } else {
                const created = await fetchJson<SyncPreset>("/api/sync/presets", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                setPresets((current) => [created, ...current]);
                setSelectedPresetId(created.id);
                showToast(forceCreate ? "New sync preset created from current draft" : "Sync preset created", "success");
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to save preset";
            setErrorMessage(message);
            showToast(message, "error");
        } finally {
            setIsSavingPreset(false);
        }
    };

    const createNewPresetDraft = () => {
        setSelectedPresetId("");
        hydrateEditorFromPreset(null);
        setWizardStep(1);
        setErrorMessage(null);
    };

    const deletePreset = async () => {
        if (!selectedPresetId) {
            return;
        }

        setIsDeletingPreset(true);
        setErrorMessage(null);
        try {
            await fetchJson<{ success: boolean }>(`/api/sync/presets/${selectedPresetId}`, {
                method: "DELETE",
            });

            setPresets((current) => current.filter((preset) => preset.id !== selectedPresetId));
            setSelectedPresetId("");
            hydrateEditorFromPreset(null);
            showToast("Sync preset deleted", "success");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete preset";
            setErrorMessage(message);
            showToast(message, "error");
        } finally {
            setIsDeletingPreset(false);
        }
    };

    const startSession = async () => {
        if (!selectedPresetId) {
            const message = "Select a preset before starting a session";
            setErrorMessage(message);
            showToast(message, "error");
            return;
        }

        if (wizardStep !== 3) {
            const message = "Go to Step 3 (Review & Start) before starting sync";
            setErrorMessage(message);
            showToast(message, "error");
            return;
        }

        if (offlineSyncDevices.length > 0) {
            const offlineNames = offlineSyncDevices.map((device) => device.name).join(", ");
            const message = `Cannot start. Offline devices: ${offlineNames}`;
            setErrorMessage(message);
            showToast(message, "error");
            return;
        }

        if (!isDirectiveActive) {
            const message = "Start is blocked unless active directive tab is Sync";
            setErrorMessage(message);
            showToast(message, "error");
            return;
        }

        setIsStartingSession(true);
        setErrorMessage(null);
        try {
            const data = await fetchJson<{ session: ActiveSession }>("/api/sync/session/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ presetId: selectedPresetId }),
            });
            setActiveSession(data.session);
            showToast("Sync session started", "success");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to start sync session";
            setErrorMessage(message);
            showToast(message, "error");
        } finally {
            setIsStartingSession(false);
            void refreshActiveSession();
        }
    };

    const stopSession = async () => {
        if (!activeSession) {
            return;
        }

        setIsStoppingSession(true);
        setErrorMessage(null);
        try {
            await fetchJson<{ session: ActiveSession }>("/api/sync/session/stop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: activeSession.id, reason: "USER_STOP" }),
            });
            setActiveSession(null);
            showToast("Sync session stopped", "info");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to stop sync session";
            setErrorMessage(message);
            showToast(message, "error");
        } finally {
            setIsStoppingSession(false);
            void refreshActiveSession();
        }
    };

    const startDisabled =
        !selectedPresetId ||
        !!activeSession ||
        isStartingSession ||
        isSavingPreset ||
        isDeletingPreset ||
        !isDirectiveActive ||
        wizardStep !== 3 ||
        offlineSyncDevices.length > 0;

    return (
        <div
            data-testid="directive-sync-videowall-panel"
            className="m-4 min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.35)]"
        >
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
                {!activeSession ? (
                    <>
                <div className="rounded-2xl border border-amber-300 bg-[linear-gradient(90deg,rgba(252,211,77,0.14),rgba(251,191,36,0.07))] px-4 py-3">
                    <p className="text-sm font-semibold tracking-wide text-amber-900">
                        Los videos a reproducirse en sync deben durar exactamente lo mismo
                    </p>
                    {typeof durationLockMs === "number" ? (
                        <p className="mt-1 text-xs text-amber-900">
                            Duration lock active: {msToSecondsLabel(durationLockMs)}
                        </p>
                    ) : null}
                    {!isDirectiveActive ? (
                        <p className="mt-1 text-xs text-amber-800">
                            Start bloqueado: activá el checkbox de la directiva Sync para permitir inicio.
                        </p>
                    ) : null}
                </div>

                <section className="rounded-2xl border border-slate-300 bg-white/90 p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.8)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {([1, 2, 3] as WizardStep[]).map((step) => {
                                const isActive = wizardStep === step;
                                const isDone = wizardStep > step;
                                const label =
                                    step === 1 ? "1. Devices" : step === 2 ? "2. Assign Videos" : "3. Review & Start";
                                return (
                                    <span
                                        key={step}
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                            isActive
                                                ? "bg-cyan-600 text-white"
                                                : isDone
                                                  ? "bg-emerald-100 text-emerald-900"
                                                  : "bg-slate-100 text-slate-600"
                                        }`}
                                    >
                                        {label}
                                    </span>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                data-testid="sync-step-prev-btn"
                                onClick={goToPreviousStep}
                                disabled={wizardStep === 1}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                data-testid="sync-step-next-btn"
                                onClick={goToNextStep}
                                disabled={wizardStep === 3}
                                className="rounded-lg border border-cyan-500 bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-600" data-testid="sync-wizard-hint">
                        {wizardStep === 1
                            ? "Step 1: Select at least two devices. Offline devices are allowed while preparing."
                            : wizardStep === 2
                              ? canProceedFromStep2
                                  ? "Step 2: Video assignments are valid. Continue to review when ready."
                                  : `Step 2: ${assignmentValidation.valid ? "Complete video assignments." : assignmentValidation.error}`
                              : offlineSyncDevices.length > 0
                                ? `Step 3: Resolve offline devices before starting (${offlineSyncDevices
                                      .map((device) => device.name)
                                      .join(", ")}).`
                                : "Step 3: Review and start the sync session."}
                    </p>
                </section>

                {wizardStep === 2 ? (
                    <section className="rounded-2xl border border-slate-300 bg-white/80 p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.8)]">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Assignment mode</p>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
                                <input
                                    type="radio"
                                    name="sync-mode"
                                    value={SYNC_PRESET_MODE.COMMON}
                                    checked={mode === SYNC_PRESET_MODE.COMMON}
                                    onChange={() => setMode(SYNC_PRESET_MODE.COMMON)}
                                />
                                Common media
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
                                <input
                                    type="radio"
                                    name="sync-mode"
                                    value={SYNC_PRESET_MODE.PER_DEVICE}
                                    checked={mode === SYNC_PRESET_MODE.PER_DEVICE}
                                    onChange={() => setMode(SYNC_PRESET_MODE.PER_DEVICE)}
                                />
                                Per device media
                            </label>
                        </div>

                        {mode === SYNC_PRESET_MODE.COMMON ? (
                            <div className="mt-3">
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                                    Common media for all devices
                                </label>
                                <select
                                    data-testid="sync-common-media-select"
                                    value={commonMediaId}
                                    onChange={(event) => setCommonMediaId(event.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
                                >
                                    <option value="">Select common video</option>
                                    {videoMediaItems.map((media) => (
                                        <option
                                            key={media.id}
                                            value={media.id}
                                            disabled={
                                                typeof media.durationMs !== "number" ||
                                                (typeof durationLockMs === "number" && media.durationMs !== durationLockMs)
                                            }
                                        >
                                            {media.name} (
                                            {typeof media.durationMs === "number"
                                                ? msToSecondsLabel(media.durationMs)
                                                : "no durationMs"}
                                            {typeof durationLockMs === "number" &&
                                            typeof media.durationMs === "number" &&
                                            media.durationMs !== durationLockMs
                                                ? ", different duration"
                                                : ""}
                                            )
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {syncDevices.map((device) => (
                                    <div key={device.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                        <p className="mb-2 text-sm font-semibold text-slate-900">{device.name}</p>
                                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                                            Assigned Media
                                        </label>
                                        <select
                                            data-testid={`sync-device-media-select-${device.id}`}
                                            value={assignedMediaByDevice[device.id] ?? ""}
                                            onChange={(event) =>
                                                setAssignedMediaByDevice((current) => ({
                                                    ...current,
                                                    [device.id]: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
                                        >
                                            <option value="">Select media file</option>
                                            {videoMediaItems.map((media) => (
                                                <option
                                                    key={media.id}
                                                    value={media.id}
                                                    disabled={
                                                        typeof media.durationMs !== "number" ||
                                                        (typeof durationLockMs === "number" && media.durationMs !== durationLockMs)
                                                    }
                                                >
                                                    {media.name} (
                                                    {typeof media.durationMs === "number"
                                                        ? msToSecondsLabel(media.durationMs)
                                                        : "no durationMs"}
                                                    {typeof durationLockMs === "number" &&
                                                    typeof media.durationMs === "number" &&
                                                    media.durationMs !== durationLockMs
                                                        ? ", different duration"
                                                        : ""}
                                                    )
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                ) : null}

                {wizardStep === 3 ? (
                    <section className="rounded-2xl border border-slate-300 bg-white/80 p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.8)]">
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
                        <select
                            data-testid="sync-preset-select"
                            value={selectedPresetId}
                            onChange={(event) => setSelectedPresetId(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
                        >
                            <option value="">New preset draft</option>
                            {presets.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.name} ({preset.mode})
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            data-testid="sync-new-preset-btn"
                            onClick={createNewPresetDraft}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700"
                        >
                            New
                        </button>
                        <button
                            type="button"
                            data-testid="sync-save-preset-btn"
                            onClick={() => savePreset()}
                            disabled={isSavingPreset || isLoading}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500 bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Save className="h-4 w-4" />
                            {isSavingPreset ? "Saving..." : "Save Preset"}
                        </button>
                        <button
                            type="button"
                            data-testid="sync-delete-preset-btn"
                            onClick={deletePreset}
                            disabled={!selectedPresetId || isDeletingPreset}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            data-testid="sync-save-as-new-preset-btn"
                            onClick={() => savePreset({ forceCreate: true })}
                            disabled={isSavingPreset || isLoading}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Save As New
                        </button>
                        <p className="text-xs text-slate-500">
                            Saved sessions are managed via Sync Presets and can be reopened for editing.
                        </p>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Saved Sync Sessions</h4>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {presets.length}
                            </span>
                        </div>
                        {presets.length === 0 ? (
                            <p className="text-xs text-slate-500">No saved sessions yet. Save the current draft to create one.</p>
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {presets.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        data-testid={`sync-saved-preset-${preset.id}`}
                                        onClick={() => openSavedPreset(preset.id)}
                                        className={`rounded-lg border px-3 py-2 text-left transition ${
                                            selectedPresetId === preset.id
                                                ? "border-cyan-500 bg-cyan-50"
                                                : "border-slate-200 bg-white hover:border-cyan-300"
                                        }`}
                                    >
                                        <p className="truncate text-sm font-semibold text-slate-900">{preset.name}</p>
                                        <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-slate-500">
                                            {preset.mode} • {preset.devices.length} devices • {msToSecondsLabel(preset.durationMs)}
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            {selectedPresetId === preset.id ? "Currently loaded" : "Click to load"}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-3">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Preset name
                        </label>
                        <input
                            data-testid="sync-preset-name-input"
                            value={presetName}
                            onChange={(event) => setPresetName(event.target.value)}
                            placeholder="Video Wall Main Hall"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
                        />
                    </div>
                    </section>
                ) : null}

                {errorMessage ? (
                    <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {errorMessage}
                    </div>
                ) : null}

                {wizardStep === 1 ? (
                    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                    <section
                        className="rounded-2xl border border-slate-300 bg-white/80 p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.8)]"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={handleDropOnAvailable}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">
                                Available Devices
                            </h3>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                {availableDevices.length}
                            </span>
                        </div>

                        <div className="space-y-2">
                            {isLoading ? (
                                <p className="text-sm text-slate-500">Loading devices...</p>
                            ) : availableDevices.length === 0 ? (
                                <p className="text-sm text-slate-500">All devices are already in synchronized devices.</p>
                            ) : (
                                availableDevices.map((device) => (
                                    <article
                                        key={device.id}
                                        draggable
                                        onDragStart={() => {
                                            setDraggedDeviceId(device.id);
                                            setDragOrigin("available");
                                        }}
                                        onDragEnd={() => {
                                            setDraggedDeviceId(null);
                                            setDragOrigin(null);
                                        }}
                                        className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:border-cyan-300 hover:bg-cyan-50/50"
                                    >
                                        <div className="flex items-center gap-2">
                                            <GripVertical className="h-4 w-4 text-slate-400" />
                                            <Monitor className="h-4 w-4 text-slate-500" />
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">{device.name}</p>
                                                <p className="text-xs text-slate-500">{getDeviceStatus(device)}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => addDeviceToSync(device.id)}
                                            className="rounded-md border border-slate-300 p-1.5 text-slate-600 transition hover:border-cyan-400 hover:text-cyan-700"
                                            aria-label={`Add ${device.name} to synchronized devices`}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </article>
                                ))
                            )}
                        </div>
                    </section>

                    <section
                        className="rounded-2xl border border-cyan-300 bg-[linear-gradient(135deg,rgba(6,182,212,0.07),rgba(14,165,233,0.12))] p-4 shadow-[0_16px_36px_-24px_rgba(6,182,212,0.55)]"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={handleDropOnSync}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-cyan-900">
                                Synchronized Devices
                            </h3>
                            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-900">
                                {syncDevices.length}
                            </span>
                        </div>
                        <p className="mb-3 text-xs text-cyan-900">
                            Select at least 2 devices to save and start a sync configuration.
                        </p>

                        <div className="space-y-3">
                            {syncDevices.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-cyan-300 bg-white/80 px-4 py-8 text-center">
                                    <p className="text-sm font-medium text-slate-700">Drag devices here to build your synchronized wall.</p>
                                    <p className="mt-1 text-xs text-slate-500">You can also use the + button from available devices.</p>
                                </div>
                            ) : (
                                syncDevices.map((device) => (
                                    <article
                                        key={device.id}
                                        draggable
                                        onDragStart={() => {
                                            setDraggedDeviceId(device.id);
                                            setDragOrigin("sync");
                                        }}
                                        onDragEnd={() => {
                                            setDraggedDeviceId(null);
                                            setDragOrigin(null);
                                        }}
                                        className="rounded-xl border border-cyan-200 bg-white/90 p-3"
                                    >
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <GripVertical className="h-4 w-4 text-slate-400" />
                                                <Monitor className="h-4 w-4 text-cyan-700" />
                                                <p className="text-sm font-semibold text-slate-900">{device.name}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeDeviceFromSync(device.id)}
                                                className="rounded-md border border-rose-200 p-1.5 text-rose-600 transition hover:bg-rose-50"
                                                aria-label={`Remove ${device.name} from synchronized devices`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>

                                        <p className="text-xs text-slate-500">
                                            Device selection only. Assign videos in Step 2.
                                        </p>
                                    </article>
                                ))
                            )}
                        </div>
                    </section>
                    </div>
                ) : null}

                {wizardStep === 3 ? (
                    <section className="rounded-2xl border border-slate-300 bg-white/80 p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.8)]">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">
                                Review & Start
                            </h3>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                {reviewRows.length} devices
                            </span>
                        </div>
                        {!selectedPresetId ? (
                            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                Save this configuration as a preset before starting the session.
                            </div>
                        ) : null}
                        {offlineSyncDevices.length > 0 ? (
                            <div className="mb-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                The following devices are offline and will block start:{" "}
                                {offlineSyncDevices.map((device) => device.name).join(", ")}
                            </div>
                        ) : (
                            <div className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                All selected devices are online.
                            </div>
                        )}
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 text-slate-500">
                                        <th className="py-2 pr-3">Device</th>
                                        <th className="py-2 pr-3">Status</th>
                                        <th className="py-2 pr-3">Assigned Video</th>
                                        <th className="py-2 pr-3">Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reviewRows.map((row) => (
                                        <tr key={row.deviceId} className="border-b border-slate-100 text-slate-700">
                                            <td className="py-2 pr-3 font-medium text-slate-900">{row.deviceName}</td>
                                            <td className="py-2 pr-3">
                                                <span
                                                    className={`rounded-full px-2 py-0.5 font-semibold ${
                                                        row.isOnline ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"
                                                    }`}
                                                >
                                                    {row.isOnline ? "Online" : "Offline"}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-3">{row.mediaName}</td>
                                            <td className="py-2 pr-3">
                                                {typeof row.durationMs === "number" ? msToSecondsLabel(row.durationMs) : "n/a"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                data-testid="sync-start-from-saved-btn"
                                onClick={startSession}
                                disabled={startDisabled}
                                className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Play className="h-3.5 w-3.5" />
                                Start from saved session
                            </button>
                            <p className="text-xs text-slate-500">
                                Traceability: session start stores `presetId` in `SyncSession` and keeps command history per device.
                            </p>
                        </div>
                    </section>
                ) : null}
                    </>
                ) : (
                    <section className="sticky top-0 z-20 rounded-2xl border border-cyan-300 bg-[linear-gradient(135deg,rgba(6,182,212,0.12),rgba(14,165,233,0.16))] px-4 py-3 shadow-[0_16px_36px_-24px_rgba(6,182,212,0.55)]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan-900">Session Running</p>
                                <p className="text-sm text-cyan-900">
                                    Sync session is active. Stop the session to return to setup steps.
                                </p>
                            </div>
                            <button
                                type="button"
                                data-testid="sync-stop-session-btn"
                                onClick={stopSession}
                                disabled={isStoppingSession}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-400 bg-slate-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Square className="h-4 w-4" />
                                {isStoppingSession ? "Stopping..." : "Stop session"}
                            </button>
                        </div>
                    </section>
                )}

                {activeSession ? (
                <section data-testid="sync-health-panel" className="rounded-2xl border border-slate-300 bg-white/80 p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.8)]">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">Session Health</h3>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <span
                                data-testid="sync-session-status"
                                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                    activeSession ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"
                                }`}
                            >
                                {activeSession ? `Active: ${activeSession.status}` : "No active session"}
                            </span>
                            {activeSession?.masterDeviceId ? (
                                <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-900">
                                    Master: {deviceById[activeSession.masterDeviceId]?.name ?? activeSession.masterDeviceId}
                                </span>
                            ) : null}
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                {activeSession?.devices.length ?? 0} devices
                            </span>
                        </div>
                    </div>
                        <div className="space-y-2">
                            {activeSession.devices.map((device) => (
                                <div
                                    key={device.id}
                                    data-testid={`sync-device-health-${device.deviceId}`}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                                >
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-slate-900">{device.device.name}</p>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(device.status)}`}>
                                            {SYNC_STATUS_LABELS[device.status] ?? device.status.toLowerCase()}
                                        </span>
                                    </div>
                                    <div className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                                        <p>last heartbeat: {heartbeatAgeLabel(device.lastSeenAt)}</p>
                                        <p>drift avg: {typeof device.avgDriftMs === "number" ? `${device.avgDriftMs.toFixed(1)}ms` : "n/a"}</p>
                                        <p>drift max: {typeof device.maxDriftMs === "number" ? `${device.maxDriftMs.toFixed(1)}ms` : "n/a"}</p>
                                        <p>clock offset: {typeof device.clockOffsetMs === "number" ? `${device.clockOffsetMs.toFixed(1)}ms` : "n/a"}</p>
                                        <p>health: {typeof device.healthScore === "number" ? device.healthScore.toFixed(2) : "n/a"}</p>
                                        <p>resync count: {device.resyncCount ?? 0}</p>
                                        <p>resync rate: {typeof device.resyncRate === "number" ? device.resyncRate.toFixed(2) : "n/a"}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                </section>
                ) : null}
            </div>
        </div>
    );
}
