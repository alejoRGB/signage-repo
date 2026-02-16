type DeviceLike = {
    status?: string;
    resyncCount?: number | null;
    healthScore?: number | null;
    maxDriftMs?: number | null;
    driftHistory?: unknown;
};

export type SyncSessionMetrics = {
    sampleCount: number;
    avgDriftMs: number | null;
    p50DriftMs: number | null;
    p90DriftMs: number | null;
    p95DriftMs: number | null;
    p99DriftMs: number | null;
    maxDriftMs: number | null;
    totalResyncs: number;
    devicesWithIssues: number;
};

export type PersistedSyncQualitySummary = {
    sampleCount: number;
    avgDriftMs: number | null;
    p50DriftMs: number | null;
    p90DriftMs: number | null;
    p95DriftMs: number | null;
    p99DriftMs: number | null;
    maxDriftMs: number | null;
    totalResyncs: number;
    devicesWithIssues: number;
};

function roundMetric(value: number | null) {
    if (value === null || Number.isNaN(value)) {
        return null;
    }
    return Number(value.toFixed(3));
}

function percentile(values: number[], percentileValue: number) {
    if (values.length === 0) {
        return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    if (sorted.length === 1) {
        return roundMetric(sorted[0]);
    }

    const rank = (percentileValue / 100) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const weight = rank - lower;
    const value = sorted[lower] * (1 - weight) + sorted[upper] * weight;
    return roundMetric(value);
}

function normalizeDriftHistory(history: unknown) {
    if (!Array.isArray(history)) {
        return [];
    }

    return history
        .map((entry) => {
            if (!entry || typeof entry !== "object") {
                return null;
            }
            const value = (entry as { driftMs?: unknown }).driftMs;
            if (typeof value !== "number" || !Number.isFinite(value)) {
                return null;
            }
            return Math.abs(value);
        })
        .filter((value): value is number => value !== null);
}

function normalizeAbsNumber(value: unknown) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }
    return Math.abs(value);
}

function isProblematicDevice(device: DeviceLike, maxObservedDriftMs: number) {
    const status = (device.status ?? "").toUpperCase();
    if (status === "ERRORED" || status === "DISCONNECTED") {
        return true;
    }

    if (typeof device.healthScore === "number" && device.healthScore < 0.7) {
        return true;
    }

    if (maxObservedDriftMs >= 500) {
        return true;
    }

    return false;
}

export function computeSyncSessionMetrics(devices: DeviceLike[]): SyncSessionMetrics {
    const allDriftValues: number[] = [];
    let totalResyncs = 0;
    let devicesWithIssues = 0;

    for (const device of devices) {
        const historyValues = normalizeDriftHistory(device.driftHistory);
        const fallbackMax = normalizeAbsNumber(device.maxDriftMs);
        const observedMax = historyValues.length > 0 ? Math.max(...historyValues) : fallbackMax ?? 0;

        if (historyValues.length > 0) {
            allDriftValues.push(...historyValues);
        } else if (fallbackMax !== null) {
            allDriftValues.push(fallbackMax);
        }

        if (typeof device.resyncCount === "number" && Number.isFinite(device.resyncCount)) {
            totalResyncs += Math.max(0, Math.trunc(device.resyncCount));
        }

        if (isProblematicDevice(device, observedMax)) {
            devicesWithIssues += 1;
        }
    }

    const sampleCount = allDriftValues.length;
    const avgDriftMs =
        sampleCount > 0 ? roundMetric(allDriftValues.reduce((sum, value) => sum + value, 0) / sampleCount) : null;
    const maxDriftMs = sampleCount > 0 ? roundMetric(Math.max(...allDriftValues)) : null;

    return {
        sampleCount,
        avgDriftMs,
        p50DriftMs: percentile(allDriftValues, 50),
        p90DriftMs: percentile(allDriftValues, 90),
        p95DriftMs: percentile(allDriftValues, 95),
        p99DriftMs: percentile(allDriftValues, 99),
        maxDriftMs,
        totalResyncs,
        devicesWithIssues,
    };
}

export function toPersistedSyncQualitySummary(metrics: SyncSessionMetrics) {
    return {
        sampleCount: metrics.sampleCount,
        avgDriftMs: metrics.avgDriftMs,
        p50DriftMs: metrics.p50DriftMs,
        p90DriftMs: metrics.p90DriftMs,
        p95DriftMs: metrics.p95DriftMs,
        p99DriftMs: metrics.p99DriftMs,
        maxDriftMs: metrics.maxDriftMs,
        totalResyncs: metrics.totalResyncs,
        devicesWithIssues: metrics.devicesWithIssues,
    } satisfies PersistedSyncQualitySummary;
}
