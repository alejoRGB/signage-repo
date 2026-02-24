type DeviceCpuTelemetrySource = {
    cpuTemp?: number | null;
    cpuTempUpdatedAt?: Date | string | null;
};

type SyncRuntimeCpuTelemetrySource = {
    cpuTemp?: number | null;
    updatedAt?: Date | string | null;
};

function toTimestampMs(value?: Date | string | null): number | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;

    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

function toIsoString(value?: Date | string | null): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();

    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function resolveLatestDeviceCpuTelemetry(
    device: DeviceCpuTelemetrySource,
    latestSyncRuntime?: SyncRuntimeCpuTelemetrySource | null
) {
    const deviceTs = toTimestampMs(device.cpuTempUpdatedAt);
    const syncTs = toTimestampMs(latestSyncRuntime?.updatedAt);

    const hasDeviceTemp = typeof device.cpuTemp === "number" && Number.isFinite(device.cpuTemp);
    const hasSyncTemp =
        typeof latestSyncRuntime?.cpuTemp === "number" && Number.isFinite(latestSyncRuntime.cpuTemp);

    if (hasSyncTemp && (!hasDeviceTemp || (syncTs ?? -1) >= (deviceTs ?? -1))) {
        return {
            cpuTemp: latestSyncRuntime?.cpuTemp ?? null,
            cpuTempUpdatedAt: toIsoString(latestSyncRuntime?.updatedAt) ?? null,
        };
    }

    return {
        cpuTemp: hasDeviceTemp ? device.cpuTemp ?? null : null,
        cpuTempUpdatedAt: toIsoString(device.cpuTempUpdatedAt) ?? null,
    };
}
